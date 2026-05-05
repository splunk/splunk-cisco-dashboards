/**
 * Lightweight wrapper around the Splunk Search API.
 *
 * Inside Splunk Web, this service uses @splunk/splunk-utils/search's
 * `oneShot` helper to run real SPL searches. When the app boots outside
 * of a Splunk runtime (e.g. local prototyping), it falls back to
 * deterministic fixtures so pages still render.
 *
 * Detection: we look for `window.$C` (Splunk Web's bootstrap object) and
 * for the presence of a CSRF token. Either is sufficient to assume we're
 * inside Splunk Web. Set `window.__SPLUNK_RUNTIME__ = false` to force the
 * mock path during development.
 *
 * Namespace: every dispatch is scoped to the splunk-cisco-dashboards
 * app, hitting `/servicesNS/-/splunk-cisco-dashboards/...`. This is
 * critical because:
 *   - Our saved searches (Executive Dashboard - ds_*) are bundled with
 *     the app and not exported globally — calls to `/services/` (no
 *     namespace) would 404 every `| savedsearch "..."` reference.
 *   - The customer_name macro is also app-scoped and must be resolved
 *     in the app context.
 *
 * Use `setSearchAppContext('<other-app>')` in dev/tests to override.
 */
import { oneShot, addLeadingSearchCommand } from '@splunk/splunk-utils/search';

// Allow-listed characters for SPL strings. We include backticks because
// Splunk macro invocations look like `macro_name(arg1)`. Strings are
// always constructed in code (never from user input), so the surface is
// narrow.
const SAFE_SPL_PATTERN = /^[\w\s\-=,.:|*"'<>()/&!?[\]{}@%+`]+$/;

// Splunk app the dispatcher should resolve saved searches in. Mutable
// only via setSearchAppContext to keep the invariant that all dispatches
// hit the same namespace.
const APP_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_\-.]{0,127}$/;
let CURRENT_APP_CONTEXT = 'splunk-cisco-dashboards';

/**
 * Override the namespace every search runs in. Useful for tests and for
 * embedding the React surface inside another Splunk app. Throws on
 * invalid app names.
 */
export const setSearchAppContext = (appName) => {
    if (typeof appName !== 'string' || !APP_NAME_PATTERN.test(appName)) {
        throw new Error('Invalid Splunk app name.');
    }
    CURRENT_APP_CONTEXT = appName;
};

export const getSearchAppContext = () => CURRENT_APP_CONTEXT;

const isInSplunkRuntime = () => {
    if (typeof window === 'undefined') return false;
    if (window.__SPLUNK_RUNTIME__ === false) return false;
    if (window.__SPLUNK_RUNTIME__ === true) return true;
    return Boolean(window.$C) || Boolean(document.cookie && document.cookie.includes('splunkweb_csrf_token'));
};

/**
 * Allow-list validation: SPL queries are constructed in code and must not
 * contain unsupported characters that could indicate injection attempts.
 * Throws if the SPL fails validation.
 */
const assertSafeSpl = (spl) => {
    if (typeof spl !== 'string' || spl.length === 0) {
        throw new TypeError('SPL must be a non-empty string.');
    }
    if (spl.length > 4096) {
        throw new RangeError('SPL exceeds maximum allowed length (4096).');
    }
    if (!SAFE_SPL_PATTERN.test(spl)) {
        throw new Error('SPL contains disallowed characters.');
    }
};

const FIXTURES = {
    'cisco:devices': [
        { hostname: 'core-sw-01', model: 'C9500-48Y4C', site: 'HQ-DC', status: 'up', uptime_days: 412 },
        { hostname: 'core-sw-02', model: 'C9500-48Y4C', site: 'HQ-DC', status: 'up', uptime_days: 410 },
        { hostname: 'edge-rt-01', model: 'ASR-1001-X', site: 'HQ-Edge', status: 'up', uptime_days: 287 },
        { hostname: 'edge-rt-02', model: 'ASR-1001-X', site: 'HQ-Edge', status: 'degraded', uptime_days: 14 },
        { hostname: 'br-sw-nyc-01', model: 'C9300-48P', site: 'NYC', status: 'up', uptime_days: 198 },
        { hostname: 'br-sw-sfo-01', model: 'C9300-48P', site: 'SFO', status: 'down', uptime_days: 0 },
        { hostname: 'fw-asa-01', model: 'ASA-5555-X', site: 'HQ-DC', status: 'up', uptime_days: 612 },
        { hostname: 'fw-ftd-01', model: 'FTD-2130', site: 'HQ-DC', status: 'up', uptime_days: 320 },
    ],
    'cisco:bandwidth': [
        { _time: '08:00', inbound_mbps: 320, outbound_mbps: 210 },
        { _time: '09:00', inbound_mbps: 410, outbound_mbps: 285 },
        { _time: '10:00', inbound_mbps: 540, outbound_mbps: 360 },
        { _time: '11:00', inbound_mbps: 612, outbound_mbps: 401 },
        { _time: '12:00', inbound_mbps: 588, outbound_mbps: 372 },
        { _time: '13:00', inbound_mbps: 555, outbound_mbps: 343 },
        { _time: '14:00', inbound_mbps: 690, outbound_mbps: 455 },
        { _time: '15:00', inbound_mbps: 720, outbound_mbps: 488 },
        { _time: '16:00', inbound_mbps: 645, outbound_mbps: 422 },
        { _time: '17:00', inbound_mbps: 470, outbound_mbps: 311 },
    ],
    'cisco:security': [
        {
            _time: '2026-05-02T18:55:21Z',
            severity: 'critical',
            signature: 'Brute-force SSH attempt',
            src_ip: '203.0.113.42',
            device: 'fw-asa-01',
        },
        {
            _time: '2026-05-02T18:42:11Z',
            severity: 'high',
            signature: 'IPS: Suspicious DNS tunneling',
            src_ip: '198.51.100.7',
            device: 'fw-ftd-01',
        },
        {
            _time: '2026-05-02T18:30:02Z',
            severity: 'medium',
            signature: 'Port-scan detected',
            src_ip: '192.0.2.130',
            device: 'edge-rt-01',
        },
        {
            _time: '2026-05-02T18:10:54Z',
            severity: 'low',
            signature: 'Policy: blocked outbound to risky domain',
            src_ip: '10.10.4.55',
            device: 'fw-ftd-01',
        },
    ],
    'cisco:cpu': [
        { hostname: 'core-sw-01', cpu_pct: 22 },
        { hostname: 'core-sw-02', cpu_pct: 24 },
        { hostname: 'edge-rt-01', cpu_pct: 71 },
        { hostname: 'edge-rt-02', cpu_pct: 88 },
        { hostname: 'br-sw-nyc-01', cpu_pct: 31 },
        { hostname: 'fw-asa-01', cpu_pct: 47 },
        { hostname: 'fw-ftd-01', cpu_pct: 53 },
    ],
};

const simulateLatency = (data, ms = 200) =>
    new Promise((resolve) => {
        setTimeout(() => resolve({ results: data }), ms);
    });

const mockSearch = ({ tag }) => simulateLatency(FIXTURES[tag] || []);

// ---------------------------------------------------------------------------
// SPL failure cache
// ---------------------------------------------------------------------------
//
// Many cards in this dashboard dispatch SPL that depends on optional
// data models (CIM Authentication, Network_Traffic, Cisco_ThousandEyes,
// etc.). On a Splunk instance that hasn't installed those add-ons the
// server returns HTTP 400 — the browser logs the failed XHR even
// though the calling component catches the rejection and falls back to
// mock data.
//
// We can't stop the browser from logging the *first* 400, but we can
// stop the same SPL from being re-dispatched on every refresh-token
// bump, time-range change, or component re-render. The cache below
// remembers SPL that previously failed (and the approximate reason)
// so subsequent calls short-circuit to mock without ever hitting the
// network.
//
// The cache is process-lifetime (not localStorage). A page reload
// gives us a clean slate, which is what an executive expects when
// they hit refresh after a config change.
const FAILED_SPL_CACHE = new Set();
const cacheKey = (spl, earliestTime, latestTime) => `${earliestTime}|${latestTime}|${spl}`;

/**
 * Test-only: clear the failure cache. Exported so React tests can
 * exercise retry paths without leaking state across test cases.
 */
export const __resetFailedSplCache = () => FAILED_SPL_CACHE.clear();

/**
 * Run a Splunk search.
 *
 * @param {Object} params
 * @param {string} params.spl - SPL query string. Must pass allow-list validation.
 * @param {string} [params.earliestTime] - Splunk earliest time modifier.
 * @param {string} [params.latestTime] - Splunk latest time modifier.
 * @param {string} [params.tag] - Logical tag used by the mock backend to map to fixture data.
 * @returns {Promise<{results: Array<Object>}>}
 */
export const runSearch = async ({
    spl,
    earliestTime = '-24h',
    latestTime = 'now',
    tag,
} = {}) => {
    assertSafeSpl(spl);

    if (!isInSplunkRuntime()) {
        return mockSearch({ tag });
    }

    // Skip SPL that has already failed once in this session (typically
    // because a CIM data model or macro isn't installed on this
    // Splunk instance). Returning empty results lets the caller's
    // mock-fallback path kick in without re-spamming the browser's
    // network log.
    const key = cacheKey(spl, earliestTime, latestTime);
    if (FAILED_SPL_CACHE.has(key)) {
        return { results: [] };
    }

    // `oneShot` runs a search synchronously on the server and returns
    // the parsed result rows. It accepts the same parameters documented
    // for the search/v2/jobs endpoint.
    //
    // CRITICAL: oneShot does NOT auto-prepend the `search ` keyword
    // (only `validateSearch` does — see node_modules/@splunk/splunk-
    // utils/search.js). Splunk's REST parser rejects any search that
    // doesn't begin with `|` or `search `, returning HTTP 400. Our
    // searchbase.conf SPL starts with a backtick macro (e.g. `index_
    // catalyst`) which IS a valid first character in SPL but NOT a
    // valid first command, so without this wrapper every literal-SPL
    // dispatch from searchbase 400s and the tile silently flips to
    // no-data — that is the "every picker swap shows no data" bug.
    // `| savedsearch "..."` dispatches escape this because they start
    // with `|`, which is why the original tiles worked.
    //
    // The second argument is the namespace tuple that drives the URL
    // path: passing `app` here pins the request to
    //   /servicesNS/-/<app>/search/v2/jobs
    // which lets `| savedsearch "..."` resolve any saved search bundled
    // with the app, even though the app isn't exported globally.
    const dispatchedSpl = addLeadingSearchCommand(spl);
    try {
        const response = await oneShot(
            {
                search: dispatchedSpl,
                earliest_time: earliestTime,
                latest_time: latestTime,
                output_mode: 'json',
                count: 1000,
            },
            { app: CURRENT_APP_CONTEXT }
        );
        return { results: (response && response.results) || [] };
    } catch (err) {
        // Remember that this SPL fails so we don't re-dispatch it on
        // the next refresh-tick. The hook layer already swallows the
        // rejection and falls back to mock data, so the user-facing
        // experience is unchanged — just quieter on subsequent loads.
        FAILED_SPL_CACHE.add(key);
        throw err;
    }
};

export const SPL = Object.freeze({
    DEVICES:
        'search index=cisco sourcetype=cisco:syslog | stats latest(status) as status by hostname, model, site, uptime_days',
    BANDWIDTH:
        'search index=cisco sourcetype=cisco:netflow | timechart span=1h sum(in_bytes) as inbound_mbps sum(out_bytes) as outbound_mbps',
    SECURITY_ALERTS:
        'search index=cisco sourcetype=cisco:asa OR sourcetype=cisco:ftd severity=* | table _time severity signature src_ip device',
    CPU: 'search index=cisco sourcetype=cisco:snmp | stats avg(cpu_pct) as cpu_pct by hostname',
});
