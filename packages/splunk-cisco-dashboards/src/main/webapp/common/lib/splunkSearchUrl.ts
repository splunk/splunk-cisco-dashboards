/**
 * Splunk Search drilldown URL builder — Build 115.13 extraction.
 *
 * The same helper has lived inline in `pages/overview/index.tsx`
 * since the dashboard launched (`splunkSearchAppUrl`). The diagram
 * canvas needs an identical builder so the new "Open in Search"
 * affordance on a status LED dispatches inside this app's
 * namespace just like the metric tiles do.
 *
 * Path shape: `/<locale>/app/<app-name>/search?q=<spl>&earliest=<e>&latest=<l>`
 *
 * Why under THIS app's namespace, not /app/search:
 *   • The platform `search` view is exported system-wide, so
 *     navigating to `/app/<any-app>/search` renders the standard
 *     Search & Reporting UI WHILE dispatching in the host app's
 *     namespace. That means `| savedsearch "..."` references to
 *     stanzas defined in this app resolve correctly without the
 *     app needing to be exported globally — same reasoning that
 *     led `splunkSearchService.js` to scope every dispatch to
 *     `/servicesNS/-/<app>/...`.
 *   • Custom macros (e.g. `customer_name`) also resolve in the
 *     host app's namespace, so the drilldown SPL behaves
 *     identically to what `useMetric` is running.
 */

const APP_NAME = 'splunk-cisco-dashboards';

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
    range: SplunkSearchTimeRange = DEFAULT_DRILLDOWN_RANGE
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
    return `/${locale}/app/${APP_NAME}/search?${params.toString()}`;
};

/** Open the Splunk Search drilldown in a new tab. No-op on the
 *  server / when the runtime is unavailable. */
export const openSplunkSearch = (
    spl: string,
    range: SplunkSearchTimeRange = DEFAULT_DRILLDOWN_RANGE
): void => {
    if (typeof window === 'undefined') return;
    const url = splunkSearchAppUrl(spl, range);
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
