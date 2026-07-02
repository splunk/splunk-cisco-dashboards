/**
 * Splunk Search drilldown URL builder — Build 115.13 extraction.
 *
 * The same helper has lived inline in `pages/overview/index.tsx`
 * since the dashboard launched (`splunkSearchAppUrl`). The diagram
 * canvas needs an identical builder so "Open in Search" affordances
 * dispatch inside the same Splunk app namespace as the metric tiles.
 *
 * Path shape: `/<locale>/app/<app-name>/search?q=<spl>&earliest=<e>&latest=<l>`
 *
 * Why under a concrete app namespace, not /app/search:
 *   • The platform `search` view is exported system-wide, so
 *     navigating to `/app/<any-app>/search` renders the standard
 *     Search & Reporting UI WHILE dispatching in the host app's
 *     namespace. For searchbase-backed searches, callers pass the
 *     stanza's `dispatch_context` so macros and data models resolve
 *     from the owning Cisco add-on app when needed — same reasoning
 *     that led `splunkSearchService.js` to scope dispatches to
 *     `/servicesNS/-/<app>/...`.
 *   • Custom macros also resolve in that host namespace, so the
 *     drilldown SPL behaves identically to what `useMetric` is
 *     running.
 */

const APP_NAME = 'splunk-cisco-dashboards';
const APP_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_\-.]{0,127}$/;

const resolveSearchAppName = (appName?: string): string =>
    appName && APP_NAME_PATTERN.test(appName) ? appName : APP_NAME;

export interface SplunkSearchTimeRange {
    earliest: string;
    latest: string;
}

/** Default time range used by the Network Diagram drilldowns when
 *  the caller doesn't supply one. `-24h@h … now` matches the
 *  window we use for the host-visibility (`| metadata type=hosts`)
 *  search behind the LED, so the operator sees the same evidence
 *  the LED is computed from. */
export const DEFAULT_DRILLDOWN_RANGE: SplunkSearchTimeRange = {
    earliest: '-24h@h',
    latest: 'now',
};

/** Build a URL into Splunk Web's Search & Reporting under this
 *  app's namespace, pre-filling the search bar with `spl` and
 *  scoping the time picker to `range`. */
export const splunkSearchAppUrl = (
    spl: string,
    range: SplunkSearchTimeRange = DEFAULT_DRILLDOWN_RANGE,
    appName?: string
): string => {
    const path =
        typeof window !== 'undefined' ? window.location.pathname : '/en-US';
    const localeMatch = path.match(/^\/([a-z]{2}-[A-Z]{2})\//);
    const locale = localeMatch ? localeMatch[1] : 'en-US';
    const params = new URLSearchParams({
        q: spl,
        earliest: range.earliest,
        latest: range.latest,
    });
    return `/${locale}/app/${resolveSearchAppName(appName)}/search?${params.toString()}`;
};

/** Open the Splunk Search drilldown in a new tab. No-op on the
 *  server / when the runtime is unavailable. */
export const openSplunkSearch = (
    spl: string,
    range: SplunkSearchTimeRange = DEFAULT_DRILLDOWN_RANGE,
    appName?: string
): void => {
    if (typeof window === 'undefined') return;
    const url = splunkSearchAppUrl(spl, range, appName);
    window.open(url, '_blank', 'noopener,noreferrer');
};

/** Quote a host token for safe inclusion in an SPL string literal.
 *  We accept the actual host as untrusted text (it could come from
 *  asset_inventory's hostname column, which is operator-edited),
 *  so we wrap in double quotes and escape embedded double quotes
 *  + backslashes. Anything else (single quotes, regex metas) is
 *  fine inside a double-quoted SPL literal.
 *
 *  Limit to 256 chars — real hostnames cap at 253 (DNS RFC 1035);
 *  256 leaves headroom for longer split-DNS aliases without
 *  letting a runaway value bloat the URL. */
export const quoteHostForSpl = (host: string): string => {
    const trimmed = host.trim().slice(0, 256);
    const escaped = trimmed.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${escaped}"`;
};

/** Convenience wrapper for the metadata drilldown the diagram
 *  canvas exposes on every device card's status LED. Returns the
 *  SPL string ready to feed into `splunkSearchAppUrl`. */
export const buildMetadataHostSpl = (host: string): string => {
    return `| metadata type=hosts | search host=${quoteHostForSpl(host)}`;
};
