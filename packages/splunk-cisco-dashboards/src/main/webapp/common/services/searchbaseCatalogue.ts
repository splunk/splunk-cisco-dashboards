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
 *
 * Visibility: stanzas with `search_hidden = 1` (or `true` / `yes`) are
 * omitted from the default catalogue so picker/search-browse UI only
 * surfaces visible entries. Pass `{ includeHidden: true }` when the
 * operator explicitly asks to browse hidden support entries, or when a
 * runtime dispatch map needs to resolve app-owned hidden support SPL
 * without falling back to savedsearches.conf indirection.
 */

import { getSearchAppContext } from './splunkSearchService';
import { resolveSearchbaseAppContexts } from './searchbaseDispatch';

/**
 * REST returns an installed app's configured label when present. Keep these
 * fallbacks for common Cisco packages whose app.conf omits a display label.
 */
export const SEARCHBASE_APP_LABEL_FALLBACKS: Readonly<Record<string, string>> = {
    'cisco-catalyst-app': 'Cisco Enterprise Networking App for Splunk',
    'cisco_dc_networking_app_for_splunk': 'Cisco DC Networking App for Splunk',
    CiscoSecurityCloud: 'Cisco Security Cloud',
    Splunk_TA_Cisco_Intersight: 'Cisco Intersight Add-on for Splunk',
    'Splunk_TA_cisco-esa': 'Splunk Add-on for Cisco ESA',
    Splunk_TA_cisco_meraki: 'Cisco Meraki Add-on for Splunk',
    'Splunk_TA_cisco-wsa': 'Splunk Add-on for Cisco WSA',
    'TA-cisco-cloud-security-addon': 'Cisco Secure Access Add-on for Splunk',
    TA_cisco_catalyst: 'Cisco Enterprise Networking Add-on for Splunk',
    ta_cisco_spaces: 'Cisco Spaces Add-on for Splunk',
    ta_cisco_thousandeyes: 'Cisco ThousandEyes App for Splunk',
};

/** Prefer an installed app label while retaining the folder name as its ID. */
export const searchbaseAppLabel = (
    app: string,
    labelsByApp: ReadonlyMap<string, string>
): string => labelsByApp.get(app) ?? SEARCHBASE_APP_LABEL_FALLBACKS[app] ?? app;

export interface SearchbaseCatalogueOptions {
    /**
     * When true, include stanzas marked `search_hidden`. Default false.
     * UI picker/search-browser consumers should omit this flag.
     */
    includeHidden?: boolean;
    /**
     * When true, fetch every installed app that ships searchbase.conf.
     * Catalogue browsers opt into this so their App/dispatch facet can
     * span all apps; runtime dispatch maps omit it to keep historical
     * current-app stanza scope and avoid same-`search_name` collisions.
     */
    allApps?: boolean;
}

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
    /** Splunk app namespace that owns/stores this stanza. */
    ownerApp: string;
    /** Source-app classification from the stanza's `dispatch_context`. */
    catalogueApp: string;
    /** Whether `dispatch_context` is forced for execution. */
    dispatchContextForce: boolean;
    /** Effective Splunk app namespace used to execute this stanza. */
    dispatchContext: string;
    /** True when the stanza is marked `search_hidden = 1` in searchbase.conf. */
    searchHidden?: boolean;
    /** HTML description (carries inline tags from the conf). */
    description: string;
    /**
     * Optional richer "what does this measure" prose, sourced from
     * the conf's `explanation` field. Many stanzas author the short
     * one-liner in `description` and a fuller paragraph in
     * `explanation`; the Searchbase Canvas chrome uses
     * `explanation || description` for the meaning-subtitle row.
     * Empty string when the stanza omits the field.
     */
    explanation: string;
    /** HTML remediation/action guidance from the conf's `solution` field. */
    solution: string;
    /** HTML references/context from the conf's `related_info` field. */
    relatedInfo: string;
    /** HTML implementation steps from the conf's `execution_plan` field. */
    executionPlan: string;
    /** SPL body — useful for the picker's preview pane. */
    search: string;
    /** Ordered, bounded contextual drilldown targets. */
    drilldownSearchNames?: string[];
    /**
     * First contextual drilldown target. Retained for compatibility with
     * consumers and browser-persisted overrides that predate multi-target
     * drilldowns. New consumers should prefer `drilldownSearchNames`.
     */
    drilldownSearchName?: string;
    /** Optional label for the tile-level drilldown affordance. */
    drilldownButtonTitle?: string;
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
        dispatch_context_force?: string;
        description?: string;
        explanation?: string;
        solution?: string;
        related_info?: string;
        execution_plan?: string;
        search?: string;
        drilldown_stanza_ids?: string;
        drilldown_stanza_id?: string;
        drilldown_search_name?: string;
        drilldown_button_title?: string;
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

interface SplunkAppEntry {
    name?: string;
    content?: { label?: string };
}

interface SplunkAppsResponse {
    entry?: SplunkAppEntry[];
}

const APP_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_\-.]{0,127}$/;

const sanitizeAppName = (raw: string | undefined): string | undefined => {
    if (typeof raw !== 'string') return undefined;
    const trimmed = raw.trim();
    return APP_NAME_PATTERN.test(trimmed) ? trimmed : undefined;
};

/**
 * Builds the REST URL for fetching `searchbase.conf` entries.
 *
 * Why `/servicesNS/-/-/` (wildcard user + wildcard app): unscoped
 * catalogue browsers need all installed apps that ship `searchbase.conf`
 * so the App facet can narrow by dispatch namespace. Runtime callers
 * use the scoped default, which adds `search=eai:acl.app=<appName>` and
 * keeps dispatch maps from being overwritten by another app's same
 * `search_name`.
 *
 * Equivalent SPL one-liner for hand-testing:
 *   | rest splunk_server=local /servicesNS/-/-/configs/conf-searchbase
 *       search="eai:acl.app=splunk-cisco-dashboards"  // scoped variant
 */
const buildUrl = (appName?: string): string => {
    if (appName && !APP_NAME_PATTERN.test(appName)) {
        throw new Error('Invalid Splunk app name.');
    }
    const params = new URLSearchParams({
        output_mode: 'json',
        count: '0',
    });
    if (appName) params.set('search', `eai:acl.app=${appName}`);
    return `/en-US/splunkd/__raw/servicesNS/-/-/configs/conf-searchbase?${params.toString()}`;
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

/** Resolve installed-app display labels while retaining folder names as IDs. */
export const getSplunkAppLabels = async (
    appIds: ReadonlySet<string>
): Promise<Map<string, string>> => {
    if (!isInSplunkRuntime() || appIds.size === 0) return new Map();
    const headers: Record<string, string> = { Accept: 'application/json' };
    const csrf = getCsrfToken();
    if (csrf) headers['X-Splunk-Form-Key'] = csrf;
    const params = new URLSearchParams({ output_mode: 'json', count: '0' });
    const response = await fetch(
        `/en-US/splunkd/__raw/services/apps/local?${params.toString()}`,
        { method: 'GET', credentials: 'include', headers }
    );
    if (!response.ok) return new Map();
    const payload = (await response.json()) as SplunkAppsResponse;
    const labels = new Map<string, string>();
    for (const entry of payload.entry ?? []) {
        const name = sanitizeAppName(entry.name);
        const label = entry.content?.label?.trim();
        if (name && appIds.has(name) && label) labels.set(name, label);
    }
    return labels;
};

const splitTags = (raw: string | undefined): string[] => {
    if (typeof raw !== 'string' || raw.length === 0) return [];
    return raw
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && t.length <= 64)
        .slice(0, 20);
};

export const isTruthyConfValue = (raw: string | undefined): boolean =>
    typeof raw === 'string' && /^(1|true|yes)$/i.test(raw.trim());

/** True when a conf-searchbase entry should be omitted from a catalogue fetch. */
export const isSearchbaseStanzaExcluded = (
    content: Pick<NonNullable<SearchbaseEntry['content']>, 'disabled' | 'search_hidden'> | undefined,
    options?: SearchbaseCatalogueOptions
): boolean => {
    const stanza = content ?? {};
    if (isTruthyConfValue(stanza.disabled)) return true;
    if (!options?.includeHidden && isTruthyConfValue(stanza.search_hidden)) return true;
    return false;
};

const sanitizeConfText = (
    raw: string | undefined,
    maxLength: number
): string | undefined => {
    if (typeof raw !== 'string') return undefined;
    const trimmed = raw.trim();
    return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : undefined;
};

/**
 * Resolves the effective drilldown identity across the config migration.
 * Legacy wins only when non-empty so an installed local override can still
 * supersede a new canonical default. New writes clear legacy and set stanza id.
 */
const SEARCHBASE_DRILLDOWN_TARGET_LIMIT = 24;
const SEARCHBASE_DRILLDOWN_TARGET_LENGTH_LIMIT = 256;

const splitConfiguredDrilldownIdentities = (raw: string | undefined): string[] => {
    const identities: string[] = [];
    const seen = new Set<string>();
    if (typeof raw !== 'string') return identities;

    raw.split(',').some((candidate) => {
        const identity = candidate.trim();
        if (
            !identity ||
            identity.length > SEARCHBASE_DRILLDOWN_TARGET_LENGTH_LIMIT ||
            seen.has(identity)
        ) {
            return false;
        }
        seen.add(identity);
        identities.push(identity);
        return identities.length >= SEARCHBASE_DRILLDOWN_TARGET_LIMIT;
    });
    return identities;
};

export const resolveConfiguredDrilldownIdentities = (content: {
    drilldown_stanza_ids?: string;
    drilldown_stanza_id?: string;
    drilldown_search_name?: string;
}): string[] => {
    // A non-empty legacy local override must continue to win over newly
    // shipped defaults. Plural stanza ids are the new canonical form; the
    // singular key remains the fallback for every existing configuration.
    const legacyName = sanitizeConfText(content.drilldown_search_name, 256);
    if (legacyName) return [legacyName];
    const pluralIds = sanitizeConfText(content.drilldown_stanza_ids, 6144);
    if (pluralIds) return splitConfiguredDrilldownIdentities(pluralIds);
    const singularId = sanitizeConfText(content.drilldown_stanza_id, 256);
    return singularId ? [singularId] : [];
};

export const resolveConfiguredDrilldownIdentity = (content: {
    drilldown_stanza_ids?: string;
    drilldown_stanza_id?: string;
    drilldown_search_name?: string;
}): string | undefined => resolveConfiguredDrilldownIdentities(content)[0];

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

const catalogueCacheKey = (options?: SearchbaseCatalogueOptions): string =>
    `${options?.includeHidden ? 'includeHidden' : 'visible'}:${
        options?.allApps ? 'allApps' : 'currentApp'
    }`;

const CACHED_PROMISES = new Map<string, Promise<SearchbaseRecord[]>>();

const collapsePlainTextWhitespace = (value: string): string =>
    value.replace(/\s+/g, ' ').trim();

const stripHtmlTagsForPlainText = (html: string): string => {
    let text = '';
    let insideTag = false;
    for (let index = 0; index < html.length; index += 1) {
        const ch = html[index];
        if (ch === '<') {
            insideTag = true;
            text += ' ';
        } else if (ch === '>') {
            insideTag = false;
            text += ' ';
        } else if (!insideTag) {
            text += ch;
        }
    }
    return text;
};

const fetchSearchbase = async (
    options?: SearchbaseCatalogueOptions
): Promise<SearchbaseRecord[]> => {
    if (!isInSplunkRuntime()) return [];
    const appName = getSearchAppContext();
    const scopedAppName = options?.allApps ? undefined : appName;
    const headers: Record<string, string> = { Accept: 'application/json' };
    const csrf = getCsrfToken();
    if (csrf) headers['X-Splunk-Form-Key'] = csrf;
    const res = await fetch(buildUrl(scopedAppName), {
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
        if (isSearchbaseStanzaExcluded(content, options)) {
            continue;
        }
        const aclApp = typeof e.acl?.app === 'string' ? e.acl.app : '';
        // Belt-and-suspenders for default current-app callers: the URL
        // already applies the ACL filter, but the response is still the
        // source of truth on older Splunk versions.
        if (scopedAppName && aclApp && aclApp !== scopedAppName) continue;
        const searchName = typeof content.search_name === 'string' ? content.search_name.trim() : '';
        if (searchName.length === 0) continue; // Without a join key we can't enrich anything.
        const ownerApp = sanitizeAppName(aclApp) || appName;
        const dispatchContextForce = isTruthyConfValue(
            content.dispatch_context_force
        );
        const appContexts = resolveSearchbaseAppContexts(
            ownerApp,
            sanitizeAppName(content.dispatch_context),
            dispatchContextForce
        );
        out.push({
            id: typeof e.name === 'string' ? e.name : '',
            searchName,
            category: typeof content.category === 'string' ? content.category : '',
            subCategory: typeof content.sub_category === 'string' ? content.sub_category : '',
            tags: splitTags(content.tags),
            // `dispatch_context` is useful catalogue provenance. When
            // force=0, keep that source app available to the App facet while
            // executing in the stanza-owning app namespace.
            ...appContexts,
            searchHidden: isTruthyConfValue(content.search_hidden),
            description: typeof content.description === 'string' ? content.description : '',
            explanation: typeof content.explanation === 'string' ? content.explanation : '',
            solution: typeof content.solution === 'string' ? content.solution : '',
            relatedInfo:
                typeof content.related_info === 'string' ? content.related_info : '',
            executionPlan:
                typeof content.execution_plan === 'string' ? content.execution_plan : '',
            search:
                typeof content.search === 'string'
                    ? collapseExpandedIndexMacro(content.search)
                    : '',
            // Prefer the legacy key when it is non-empty. This is deliberate:
            // an installed local/searchbase.conf may still override the old
            // key while the app's upgraded default stanza supplies the new
            // key. New admin writes clear both compatibility keys and set the
            // canonical ordered stanza-id list.
            drilldownSearchNames: resolveConfiguredDrilldownIdentities(content),
            drilldownSearchName: resolveConfiguredDrilldownIdentity(content),
            drilldownButtonTitle: sanitizeConfText(content.drilldown_button_title, 120),
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
export const getSearchbaseCatalogue = async (
    options?: SearchbaseCatalogueOptions
): Promise<SearchbaseRecord[]> => {
    const cacheKey = catalogueCacheKey(options);
    let cached = CACHED_PROMISES.get(cacheKey);
    if (!cached) {
        cached = fetchSearchbase(options).catch((err) => {
            CACHED_PROMISES.delete(cacheKey);
            throw err;
        });
        CACHED_PROMISES.set(cacheKey, cached);
    }
    return cached;
};

/**
 * Strips the inline HTML tags Splunk allows in conf descriptions so
 * the picker can show the text in a tooltip / pill without rendering
 * markup. Whitespace is collapsed for compact preview.
 */
export const plainTextFromHtml = (html: string): string => {
    if (typeof html !== 'string' || html.length === 0) {
        return '';
    }
    if (typeof DOMParser !== 'undefined') {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return collapsePlainTextWhitespace(doc.body.textContent ?? '');
    }
    return collapsePlainTextWhitespace(stripHtmlTagsForPlainText(html));
};

/** Force the next call to re-fetch from Splunk. */
export const clearSearchbaseCache = (): void => {
    CACHED_PROMISES.clear();
};
