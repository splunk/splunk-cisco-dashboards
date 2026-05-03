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
 */
import { oneShot } from '@splunk/splunk-utils/search';

const SAFE_SPL_PATTERN = /^[\w\s\-=,.:|*"'<>()/&!?[\]{}@%+]+$/;

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

    // `oneShot` runs a search synchronously on the server and returns
    // the parsed result rows. It accepts the same parameters documented
    // for the search/v2/jobs endpoint.
    const response = await oneShot({
        search: spl,
        earliest_time: earliestTime,
        latest_time: latestTime,
        output_mode: 'json',
        count: 1000,
    });
    return { results: (response && response.results) || [] };
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
