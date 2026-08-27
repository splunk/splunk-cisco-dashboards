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
 * Namespace: dispatches default to the splunk-cisco-dashboards app,
 * hitting `/servicesNS/-/splunk-cisco-dashboards/...`, but callers can
 * pass `appContext` for searchbase entries whose `dispatch_context`
 * points at a dependency app. This matters for searches that rely on
 * macros or data models owned by Cisco add-ons.
 *
 * Use `setSearchAppContext('<other-app>')` in dev/tests to override
 * the default namespace for calls that omit `appContext`.
 */
import { addLeadingSearchCommand } from "@splunk/splunk-utils/search";
import { createRESTURL } from "@splunk/splunk-utils/url";
import {
  findErrorMessage,
  getDefaultFetchInit,
  handleResponse,
} from "@splunk/splunk-utils/fetch";
import querystring from "querystring";

// SPL is authored in searchbase.conf or code, not typed directly by
// an end user. A character allow-list is too brittle for real SPL
// (`match(field,"^Managed")`, sed expressions, regex capture groups,
// comments, etc.), so we reject only control characters that cannot be
// part of a valid search body.
const UNSAFE_CONTROL_CHAR_PATTERN =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
// SPL length cap. The previous 32 KiB ceiling was conservative
// dashboard-defaults — fine for "search index=cisco | stats..."
// queries but too tight for the diagram-persistence pipeline,
// which inlines the full diagram payload (up to 256 KiB) into
// an `outputlookup` job so the browser doesn't have to ship the
// CSV body. 300 KiB leaves headroom for the surrounding
// `inputlookup ... | where ... | append [...]` skeleton plus
// any future fields. The real safety guard is the
// control-character check above, not the length cap.
const MAX_SPL_LENGTH = 300 * 1024;

const isCanvasDebug = () => {
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage?.getItem("searchbase.canvas.debug") === "1") {
      return true;
    }
  } catch {
    // DOM storage can be unavailable while the URL switch still works.
  }
  try {
    return (
      new URLSearchParams(window.location.search).get("canvasDebug") === "1"
    );
  } catch {
    return false;
  }
};

let canvasDebugBannerShown = false;
const announceCanvasDebug = () => {
  if (canvasDebugBannerShown || !isCanvasDebug()) return;
  canvasDebugBannerShown = true;
  // Warning level is deliberate: Chrome's default console level always shows
  // this one-time activation banner, even when verbose/debug messages are
  // hidden. Search contents and result data are never logged.
  // eslint-disable-next-line no-console
  console.warn(
    "[SSNE Diagnostics] ENABLED — filter for [SSNE Search] or [SSNE Tile]. " +
      "Timeline entries include stage, queue wait, run time, result count, " +
      "no-data outcomes, and failures.",
  );
};

const canvasDebug = (...args) => {
  if (!isCanvasDebug()) return;
  announceCanvasDebug();
  // eslint-disable-next-line no-console
  console.debug(...args);
};

const canvasTrace = (outcome, detail) => {
  if (!isCanvasDebug()) return;
  announceCanvasDebug();
  // Intentionally use info so operators see the high-level timeline with the
  // browser console's default filters. Low-level queue internals remain under
  // console.debug. Never include full SPL or result contents here.
  // eslint-disable-next-line no-console
  // Serialize the bounded summary into the message itself. Chrome users can
  // read it without expanding an opaque `Object`, and browser automation can
  // capture the same timing/failure evidence during live verification.
  // eslint-disable-next-line no-console
  console.info(`[SSNE Search] ${outcome} ${JSON.stringify(detail)}`);
};

const elapsedMs = (startedAt, endedAt = Date.now()) =>
  Math.max(0, endedAt - startedAt);

const dispatchStageLabel = (priority) => {
  const normalized = normalizeDispatchPriority(priority);
  if (normalized === 0) return "Signal Rail";
  if (normalized >= 10 && normalized < 100) {
    return `Section stage ${Math.floor(normalized / 10)}`;
  }
  return "Background";
};

const splFingerprint = (spl) =>
  typeof spl === "string" ? spl.trim().slice(0, 60) : "";

// Splunk app the dispatcher should resolve saved searches in. Mutable
// only via setSearchAppContext to keep the invariant that all dispatches
// hit the same namespace.
const APP_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_\-.]{0,127}$/;
let CURRENT_APP_CONTEXT = "splunk-cisco-dashboards";

/**
 * Override the namespace every search runs in. Useful for tests and for
 * embedding the React surface inside another Splunk app. Throws on
 * invalid app names.
 */
export const setSearchAppContext = (appName) => {
  if (typeof appName !== "string" || !APP_NAME_PATTERN.test(appName)) {
    throw new Error("Invalid Splunk app name.");
  }
  CURRENT_APP_CONTEXT = appName;
};

export const getSearchAppContext = () => CURRENT_APP_CONTEXT;

const resolveSearchAppContext = (appContext) => {
  if (appContext === undefined || appContext === null || appContext === "") {
    return CURRENT_APP_CONTEXT;
  }
  if (typeof appContext !== "string" || !APP_NAME_PATTERN.test(appContext)) {
    throw new Error("Invalid Splunk app name.");
  }
  return appContext;
};

const isInSplunkRuntime = () => {
  if (typeof window === "undefined") return false;
  if (window.__SPLUNK_RUNTIME__ === false) return false;
  if (window.__SPLUNK_RUNTIME__ === true) return true;
  return (
    Boolean(window.$C) ||
    Boolean(document.cookie && document.cookie.includes("splunkweb_csrf_token"))
  );
};

/**
 * Guard validation: SPL queries are constructed in code and must not
 * contain raw control characters or runaway payloads.
 * Throws if the SPL fails validation.
 */
const assertSafeSpl = (spl) => {
  if (typeof spl !== "string" || spl.length === 0) {
    throw new TypeError("SPL must be a non-empty string.");
  }
  if (spl.length > MAX_SPL_LENGTH) {
    throw new RangeError(
      `SPL exceeds maximum allowed length (${MAX_SPL_LENGTH}).`,
    );
  }
  if (UNSAFE_CONTROL_CHAR_PATTERN.test(spl)) {
    throw new Error("SPL contains disallowed characters.");
  }
};

const FIXTURES = {
  "cisco:devices": [
    {
      hostname: "core-sw-01",
      model: "C9500-48Y4C",
      site: "HQ-DC",
      status: "up",
      uptime_days: 412,
    },
    {
      hostname: "core-sw-02",
      model: "C9500-48Y4C",
      site: "HQ-DC",
      status: "up",
      uptime_days: 410,
    },
    {
      hostname: "edge-rt-01",
      model: "ASR-1001-X",
      site: "HQ-Edge",
      status: "up",
      uptime_days: 287,
    },
    {
      hostname: "edge-rt-02",
      model: "ASR-1001-X",
      site: "HQ-Edge",
      status: "degraded",
      uptime_days: 14,
    },
    {
      hostname: "br-sw-nyc-01",
      model: "C9300-48P",
      site: "NYC",
      status: "up",
      uptime_days: 198,
    },
    {
      hostname: "br-sw-sfo-01",
      model: "C9300-48P",
      site: "SFO",
      status: "down",
      uptime_days: 0,
    },
    {
      hostname: "fw-asa-01",
      model: "ASA-5555-X",
      site: "HQ-DC",
      status: "up",
      uptime_days: 612,
    },
    {
      hostname: "fw-ftd-01",
      model: "FTD-2130",
      site: "HQ-DC",
      status: "up",
      uptime_days: 320,
    },
  ],
  "cisco:bandwidth": [
    { _time: "08:00", inbound_mbps: 320, outbound_mbps: 210 },
    { _time: "09:00", inbound_mbps: 410, outbound_mbps: 285 },
    { _time: "10:00", inbound_mbps: 540, outbound_mbps: 360 },
    { _time: "11:00", inbound_mbps: 612, outbound_mbps: 401 },
    { _time: "12:00", inbound_mbps: 588, outbound_mbps: 372 },
    { _time: "13:00", inbound_mbps: 555, outbound_mbps: 343 },
    { _time: "14:00", inbound_mbps: 690, outbound_mbps: 455 },
    { _time: "15:00", inbound_mbps: 720, outbound_mbps: 488 },
    { _time: "16:00", inbound_mbps: 645, outbound_mbps: 422 },
    { _time: "17:00", inbound_mbps: 470, outbound_mbps: 311 },
  ],
  "cisco:security": [
    {
      _time: "2026-05-02T18:55:21Z",
      severity: "critical",
      signature: "Brute-force SSH attempt",
      src_ip: "203.0.113.42",
      device: "fw-asa-01",
    },
    {
      _time: "2026-05-02T18:42:11Z",
      severity: "high",
      signature: "IPS: Suspicious DNS tunneling",
      src_ip: "198.51.100.7",
      device: "fw-ftd-01",
    },
    {
      _time: "2026-05-02T18:30:02Z",
      severity: "medium",
      signature: "Port-scan detected",
      src_ip: "192.0.2.130",
      device: "edge-rt-01",
    },
    {
      _time: "2026-05-02T18:10:54Z",
      severity: "low",
      signature: "Policy: blocked outbound to risky domain",
      src_ip: "10.10.4.55",
      device: "fw-ftd-01",
    },
  ],
  "cisco:cpu": [
    { hostname: "core-sw-01", cpu_pct: 22 },
    { hostname: "core-sw-02", cpu_pct: 24 },
    { hostname: "edge-rt-01", cpu_pct: 71 },
    { hostname: "edge-rt-02", cpu_pct: 88 },
    { hostname: "br-sw-nyc-01", cpu_pct: 31 },
    { hostname: "fw-asa-01", cpu_pct: 47 },
    { hostname: "fw-ftd-01", cpu_pct: 53 },
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
const cacheKey = (spl, earliestTime, latestTime, appContext) =>
  `${appContext}|${earliestTime}|${latestTime}|${spl}`;

// Multiple dashboard surfaces can bind to the same Searchbase stanza. The
// Signal Rail is the most visible example: it intentionally repeats headline
// searches that also power section tiles. Without coalescing, every consumer
// creates its own Splunk one-shot job, which wastes search concurrency and can
// leave the entire page waiting behind duplicate high-volume scans.
//
// Entries live only while the server request is unresolved. This keeps manual
// refresh semantics honest (a later refresh always creates a new job) while
// allowing consumers mounted in the same render pass to share one dispatch.
/**
 * @typedef {{
 *   controller: AbortController,
 *   promise: Promise<Object>,
 *   consumerCount: number,
 *   settled: boolean,
 *   diagnosticId: number,
 *   enqueuedAt: number,
 *   startedAt: number | null,
 *   primaryTag: string,
 *   priority: number,
 *   promotePriority?: (priority: number) => void,
 * }} InFlightSearch
 */
/** @type {Map<string, InFlightSearch>} */
const IN_FLIGHT_SEARCHES = new Map();
const inFlightSearchKey = (spl, earliestTime, latestTime, appContext, count) =>
  `${cacheKey(spl, earliestTime, latestTime, appContext)}|count=${count}`;

/** Supported per-viewer limits for in-flight Splunk one-shot dispatches. */
export const MIN_CONCURRENT_TILE_SEARCHES = 1;
export const MAX_CONCURRENT_TILE_SEARCHES = 4;
export const DEFAULT_CONCURRENT_TILE_SEARCHES = 2;

/** Default priority for callers that do not participate in staged loading. */
export const DEFAULT_DISPATCH_PRIORITY = 100;

const DISPATCH_RETRY_BASE_MS = [500, 1500, 4000];
const DISPATCH_MAX_ATTEMPTS = 1 + DISPATCH_RETRY_BASE_MS.length;

let dispatchConcurrency = DEFAULT_CONCURRENT_TILE_SEARCHES;
let dispatchInFlight = 0;
let activeDispatchPriority = null;
let searchDiagnosticSequence = 0;
/** @type {Array<{ resolve: () => void, reject: (err: Error) => void, priority: number, granted: boolean, signal?: AbortSignal, onAbortCleanup?: () => void }>} */
const dispatchWaitQueue = [];

const normalizeDispatchPriority = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.max(0, Math.round(parsed))
    : DEFAULT_DISPATCH_PRIORITY;
};

const normalizeDispatchConcurrency = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_CONCURRENT_TILE_SEARCHES;
  }
  return Math.max(
    MIN_CONCURRENT_TILE_SEARCHES,
    Math.min(MAX_CONCURRENT_TILE_SEARCHES, Math.round(parsed)),
  );
};

const makeAbortError = () =>
  typeof DOMException !== "undefined"
    ? new DOMException("Aborted", "AbortError")
    : Object.assign(new Error("Aborted"), { name: "AbortError" });

const abortPromise = (signal) => {
  if (!signal) return null;
  if (signal.aborted) {
    return Promise.reject(makeAbortError());
  }
  return new Promise((_, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(makeAbortError());
    };
    signal.addEventListener("abort", onAbort);
  });
};

const cancellableSleep = (ms, signal) => {
  if (!signal) {
    return sleep(ms);
  }
  if (signal.aborted) {
    return Promise.reject(makeAbortError());
  }
  const raced = Promise.race([sleep(ms), abortPromise(signal)]);
  return raced;
};

const removeQueuedEntry = (entry) => {
  const idx = dispatchWaitQueue.indexOf(entry);
  if (idx !== -1) {
    dispatchWaitQueue.splice(idx, 1);
  }
};

const queuedPriorityCount = (priority) =>
  dispatchWaitQueue.reduce(
    (count, entry) => count + (entry.priority === priority ? 1 : 0),
    0,
  );

const nextQueuedPriority = () => {
  let next = null;
  for (const entry of dispatchWaitQueue) {
    if (entry.signal?.aborted) continue;
    if (next === null || entry.priority < next) {
      next = entry.priority;
    }
  }
  return next;
};

const drainDispatchQueue = () => {
  while (dispatchInFlight < dispatchConcurrency) {
    if (activeDispatchPriority === null) {
      activeDispatchPriority = nextQueuedPriority();
      if (activeDispatchPriority === null) return;
    }

    const nextIndex = dispatchWaitQueue.findIndex(
      (entry) => entry.priority === activeDispatchPriority,
    );
    if (nextIndex === -1) {
      // A priority group is a barrier: do not begin the next group until
      // every dispatch already running in the current group has settled.
      if (dispatchInFlight > 0) return;
      activeDispatchPriority = null;
      continue;
    }

    const [next] = dispatchWaitQueue.splice(nextIndex, 1);
    if (next?.onAbortCleanup) next.onAbortCleanup();
    if (next?.signal?.aborted) {
      next.reject(makeAbortError());
      continue;
    }

    next.granted = true;
    dispatchInFlight += 1;
    canvasDebug("[search/queue] grant", {
      activePriority: activeDispatchPriority,
      concurrency: dispatchConcurrency,
      inFlight: dispatchInFlight,
      queueLength: dispatchWaitQueue.length,
    });
    next.resolve();
  }
};

/**
 * Update the per-viewer dispatch cap. Running searches are never cancelled;
 * the new value is applied to queued work as slots become available.
 */
export const setTileSearchConcurrency = (value) => {
  dispatchConcurrency = normalizeDispatchConcurrency(value);
  drainDispatchQueue();
  return dispatchConcurrency;
};

export const getTileSearchConcurrency = () => dispatchConcurrency;

const acquireDispatchSlot = (signal, requestedPriority) => {
  if (signal?.aborted) {
    return {
      promise: Promise.reject(makeAbortError()),
      promotePriority: () => {},
    };
  }
  let entry;
  const promise = new Promise((resolve, reject) => {
    entry = {
      resolve,
      reject,
      signal,
      priority: normalizeDispatchPriority(requestedPriority),
      granted: false,
    };
    canvasDebug("[search/queue] wait", {
      activePriority: activeDispatchPriority,
      concurrency: dispatchConcurrency,
      inFlight: dispatchInFlight,
      queueLength: dispatchWaitQueue.length + 1,
      priority: entry.priority,
    });
    if (signal) {
      const onAbort = () => {
        signal.removeEventListener("abort", onAbort);
        if (entry.granted) return;
        removeQueuedEntry(entry);
        canvasDebug("[search/queue] abort", {
          queueLength: dispatchWaitQueue.length,
          aborted: true,
        });
        reject(makeAbortError());
        if (
          dispatchInFlight === 0 &&
          activeDispatchPriority !== null &&
          queuedPriorityCount(activeDispatchPriority) === 0
        ) {
          activeDispatchPriority = null;
        }
        drainDispatchQueue();
      };
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort);
      entry.onAbortCleanup = () => signal.removeEventListener("abort", onAbort);
    }
    dispatchWaitQueue.push(entry);
    // React effects are not guaranteed to enqueue in visual order. A
    // section tile can therefore claim the first slot a few milliseconds
    // before the Signal Rail, even though the rail has priority 0. Let a
    // newly queued higher-priority group preempt the *queued* portion of
    // the active group. Searches already in flight are left alone; the
    // higher-priority work receives the next available slot.
    if (
      activeDispatchPriority !== null &&
      entry.priority < activeDispatchPriority
    ) {
      activeDispatchPriority = entry.priority;
    }
    drainDispatchQueue();
  });
  return {
    promise,
    promotePriority: (priority) => {
      if (!entry || entry.granted) return;
      const nextPriority = normalizeDispatchPriority(priority);
      if (nextPriority >= entry.priority) return;
      entry.priority = nextPriority;
      if (
        activeDispatchPriority !== null &&
        nextPriority < activeDispatchPriority
      ) {
        activeDispatchPriority = nextPriority;
      }
      canvasDebug("[search/queue] promote", {
        activePriority: activeDispatchPriority,
        priority: nextPriority,
        queueLength: dispatchWaitQueue.length,
      });
      drainDispatchQueue();
    },
  };
};

const releaseDispatchSlot = () => {
  dispatchInFlight = Math.max(0, dispatchInFlight - 1);
  if (
    dispatchInFlight === 0 &&
    activeDispatchPriority !== null &&
    queuedPriorityCount(activeDispatchPriority) === 0
  ) {
    activeDispatchPriority = null;
  }
  drainDispatchQueue();
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const jitteredDelay = (baseMs) => {
  const spread = baseMs * 0.2;
  return Math.max(0, baseMs + (Math.random() * 2 - 1) * spread);
};

/**
 * Splunk dispatch/job failure with a stable machine-readable kind for UI.
 * @public
 */
export class SearchDispatchError extends Error {
  /**
   * @param {string} message
   * @param {{ httpStatus?: number, kind?: 'dispatch_failed'|'job_failed', retryable?: boolean }} [meta]
   */
  constructor(
    message,
    { httpStatus, kind = "dispatch_failed", retryable = false } = {},
  ) {
    super(message);
    this.name = "SearchDispatchError";
    this.httpStatus = httpStatus;
    this.kind = kind;
    this.retryable = retryable;
  }
}

export const isAbortError = (err) =>
  (typeof DOMException !== "undefined" &&
    err instanceof DOMException &&
    err.name === "AbortError") ||
  (err && typeof err === "object" && err.name === "AbortError");

const isNetworkError = (err) => {
  if (!err || typeof err !== "object") return false;
  if (isAbortError(err)) return false;
  if (err instanceof TypeError) return true;
  const message = typeof err.message === "string" ? err.message : "";
  return /failed to fetch|network|load failed/i.test(message);
};

const isRetryableHttpStatus = (status) => status === 503 || status === 429;

const shouldCacheSplFailure = (status) =>
  typeof status === "number" &&
  status >= 400 &&
  status < 500 &&
  !isRetryableHttpStatus(status);

const splunkJobErrorText = (payload) => {
  const entry = findErrorMessage(payload);
  return entry && typeof entry.text === "string" ? entry.text : null;
};

/**
 * Map a rejected dispatch to UI-facing reason metadata.
 * @param {unknown} err
 * @returns {{ reason: 'dispatch_failed'|'job_failed'|'error', message: string, httpStatus?: number }}
 */
export const classifySearchDispatchError = (err) => {
  if (err instanceof SearchDispatchError) {
    return {
      reason: err.kind === "job_failed" ? "job_failed" : "dispatch_failed",
      message: err.message,
      httpStatus: err.httpStatus,
    };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { reason: "error", message };
};

const dispatchOneShot = async (searchParameters, namespaceOptions, signal) => {
  const response = await fetch(
    createRESTURL("search/v2/jobs", namespaceOptions),
    {
      ...getDefaultFetchInit(),
      method: "POST",
      body: querystring.encode({
        output_mode: "json",
        ...searchParameters,
        exec_mode: "oneshot",
      }),
      signal,
    },
  );

  if (response.status !== 200) {
    const status = response.status;
    let message = `Search dispatch failed (HTTP ${status})`;
    try {
      const body = await response.json();
      const serverText = splunkJobErrorText(body);
      if (serverText) message = serverText;
    } catch {
      // Non-JSON 503 bodies are common under load; keep the HTTP status message.
    }
    throw new SearchDispatchError(message, {
      httpStatus: status,
      kind: "dispatch_failed",
      retryable: isRetryableHttpStatus(status),
    });
  }

  const payload = await handleResponse(200)(response);
  const jobError = splunkJobErrorText(payload);
  if (jobError) {
    throw new SearchDispatchError(jobError, {
      kind: "job_failed",
      retryable: false,
    });
  }
  return payload;
};

const dispatchOneShotWithRetry = async (
  searchParameters,
  namespaceOptions,
  signal,
) => {
  let lastError;
  for (let attempt = 0; attempt < DISPATCH_MAX_ATTEMPTS; attempt += 1) {
    if (signal?.aborted) {
      throw makeAbortError();
    }
    try {
      const payload = await dispatchOneShot(
        searchParameters,
        namespaceOptions,
        signal,
      );
      canvasDebug("[search/dispatch] retry-outcome", {
        attempt: attempt + 1,
        outcome: "resolved",
      });
      return payload;
    } catch (err) {
      lastError = err;
      if (isAbortError(err)) {
        canvasDebug("[search/dispatch] retry-outcome", {
          attempt: attempt + 1,
          outcome: "aborted",
        });
        throw err;
      }
      const status =
        err instanceof SearchDispatchError ? err.httpStatus : undefined;
      const retryable =
        (err instanceof SearchDispatchError && err.retryable) ||
        isRetryableHttpStatus(status) ||
        isNetworkError(err);
      const hasMoreAttempts = attempt < DISPATCH_MAX_ATTEMPTS - 1;
      canvasDebug("[search/dispatch] retry-outcome", {
        attempt: attempt + 1,
        outcome: retryable && hasMoreAttempts ? "retry" : "reject",
        httpStatus: status,
        retryable,
      });
      if (!retryable || !hasMoreAttempts) {
        throw err;
      }
      await cancellableSleep(
        jitteredDelay(DISPATCH_RETRY_BASE_MS[attempt]),
        signal,
      );
    }
  }
  throw lastError;
};

/**
 * Test-only: clear the failure cache. Exported so React tests can
 * exercise retry paths without leaking state across test cases.
 */
export const __resetFailedSplCache = () => FAILED_SPL_CACHE.clear();

/**
 * Test-only: reset the dispatch concurrency queue between cases.
 */
export const __resetDispatchQueue = () => {
  IN_FLIGHT_SEARCHES.forEach((entry) => {
    entry.controller.abort();
  });
  IN_FLIGHT_SEARCHES.clear();
  dispatchConcurrency = DEFAULT_CONCURRENT_TILE_SEARCHES;
  dispatchInFlight = 0;
  activeDispatchPriority = null;
  searchDiagnosticSequence = 0;
  dispatchWaitQueue.length = 0;
};

/**
 * Attach one caller to a shared in-flight dispatch. A caller abort releases
 * only its own subscription; the server request is cancelled only after the
 * final consumer leaves. This prevents a collapsed tile from cancelling the
 * same search while the Signal Rail still needs it (and vice versa).
 *
 * @param {InFlightSearch} entry
 * @param {AbortSignal | undefined} signal
 * @returns {Promise<Object>}
 */
const consumeInFlightSearch = (entry, signal) => {
  if (signal?.aborted) {
    return Promise.reject(makeAbortError());
  }

  const sharedEntry = entry;
  sharedEntry.consumerCount += 1;
  return new Promise((resolve, reject) => {
    let finished = false;
    let onAbort;
    const release = () => {
      if (finished) {
        return;
      }
      finished = true;
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
      sharedEntry.consumerCount = Math.max(0, sharedEntry.consumerCount - 1);
      if (sharedEntry.consumerCount === 0 && !sharedEntry.settled) {
        sharedEntry.controller.abort();
      }
    };
    onAbort = () => {
      release();
      reject(makeAbortError());
    };

    if (signal) {
      signal.addEventListener("abort", onAbort);
    }
    sharedEntry.promise.then(
      (value) => {
        if (finished) {
          return;
        }
        release();
        resolve(value);
      },
      (err) => {
        if (finished) {
          return;
        }
        release();
        reject(err);
      },
    );
  });
};

/**
 * Run a Splunk search.
 *
 * @param {Object} params
 * @param {string} params.spl - SPL query string. Must pass allow-list validation.
 * @param {string} [params.earliestTime] - Splunk earliest time modifier.
 * @param {string} [params.latestTime] - Splunk latest time modifier.
 * @param {string} [params.tag] - Logical tag used by the mock backend to map to fixture data.
 * @param {string} [params.appContext] - Splunk app namespace to dispatch in.
 * @param {number} [params.count] - Maximum result rows. Defaults to 1000 for
 *   regular dashboard tiles (the Splunk Web cap is also 1000 by default).
 *   Pass a larger value for metadata-style searches that need the full
 *   population — e.g. `| metadata type=hosts` on a stack with thousands of
 *   reporting hosts. Pass 0 to disable the cap (Splunk semantics: count=0 →
 *   "return all results"); the server-side `max_count` setting still applies.
 * @param {AbortSignal} [params.signal] - When aborted, queued dispatches are
 *   dropped, in-flight fetch is cancelled, and retry sleeps end early.
 * @param {number} [params.dispatchPriority] - Lower numbers dispatch first.
 *   Priority groups are barriers, so a later group starts only after the
 *   current group has fully settled. Defaults to 100 for generic callers.
 * @returns {Promise<{results: Array<Object>, cachedFailure?: boolean}>}
 */
export const runSearch = async ({
  spl,
  earliestTime = "-24h",
  latestTime = "now",
  tag,
  appContext,
  count = 1000,
  signal,
  dispatchPriority = DEFAULT_DISPATCH_PRIORITY,
} = {}) => {
  assertSafeSpl(spl);
  const resolvedAppContext = resolveSearchAppContext(appContext);
  const normalizedPriority = normalizeDispatchPriority(dispatchPriority);
  const requestEnqueuedAt = Date.now();
  const requestId = ++searchDiagnosticSequence;
  const searchLabel = tag || "unnamed-search";
  const stage = dispatchStageLabel(normalizedPriority);

  if (signal?.aborted) {
    throw makeAbortError();
  }

  canvasDebug("[search/dispatch] enqueue", {
    tag: tag || null,
    appContext: resolvedAppContext,
    spl: splFingerprint(spl),
    aborted: Boolean(signal?.aborted),
  });
  canvasTrace("QUEUED", {
    id: requestId,
    search: searchLabel,
    stage,
    priority: normalizedPriority,
    timeRange: `${earliestTime} to ${latestTime}`,
    concurrency: dispatchConcurrency,
  });

  if (!isInSplunkRuntime()) {
    canvasTrace("MOCK RESULT", {
      id: requestId,
      search: searchLabel,
      stage,
      totalMs: elapsedMs(requestEnqueuedAt),
    });
    return mockSearch({ tag });
  }

  // Skip SPL that has already failed once in this session (typically
  // because a CIM data model or macro isn't installed on this
  // Splunk instance). Returning empty results lets the caller's
  // mock-fallback path kick in without re-spamming the browser's
  // network log.
  const key = cacheKey(spl, earliestTime, latestTime, resolvedAppContext);
  if (FAILED_SPL_CACHE.has(key)) {
    canvasTrace("NO DATA (cached prior failure)", {
      id: requestId,
      search: searchLabel,
      stage,
      rows: 0,
      totalMs: elapsedMs(requestEnqueuedAt),
    });
    return { results: [], cachedFailure: true };
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
  // /servicesNS/-/<app>/search/v2/jobs
  // which lets `| savedsearch "..."` resolve any saved search bundled
  // with the app, even though the app isn't exported globally.
  const dispatchedSpl = addLeadingSearchCommand(spl);
  const namespace = { app: resolvedAppContext };
  const searchParameters = {
    search: dispatchedSpl,
    earliest_time: earliestTime,
    latest_time: latestTime,
    output_mode: "json",
    count,
  };

  const sharedKey = inFlightSearchKey(
    spl,
    earliestTime,
    latestTime,
    resolvedAppContext,
    count,
  );
  let inFlight = IN_FLIGHT_SEARCHES.get(sharedKey);
  // Preference hydration and workspace reconfiguration can unmount a search
  // consumer and immediately mount a replacement for the same SPL. When the
  // last old consumer leaves, the shared controller is aborted. Never attach
  // the replacement to that doomed promise: it would reject with AbortError,
  // and metric hooks intentionally ignore aborts, leaving the new tile stuck
  // in its loading state indefinitely.
  if (inFlight?.controller.signal.aborted) {
    if (IN_FLIGHT_SEARCHES.get(sharedKey) === inFlight) {
      IN_FLIGHT_SEARCHES.delete(sharedKey);
    }
    inFlight = undefined;
  }
  if (!inFlight) {
    const controller = new AbortController();
    let slotHeld = false;
    const dispatchSlot = acquireDispatchSlot(
      controller.signal,
      dispatchPriority,
    );
    /** @type {InFlightSearch} */
    const created = {
      controller,
      consumerCount: 0,
      settled: false,
      diagnosticId: requestId,
      enqueuedAt: requestEnqueuedAt,
      startedAt: null,
      primaryTag: searchLabel,
      priority: normalizedPriority,
      promise: Promise.resolve({}),
      promotePriority: dispatchSlot.promotePriority,
    };
    created.promise = dispatchSlot.promise
      .then(() => {
        slotHeld = true;
        created.startedAt = Date.now();
        canvasTrace("RUNNING", {
          id: created.diagnosticId,
          search: created.primaryTag,
          stage: dispatchStageLabel(created.priority),
          priority: created.priority,
          queueWaitMs: elapsedMs(created.enqueuedAt, created.startedAt),
          inFlight: dispatchInFlight,
          concurrency: dispatchConcurrency,
        });
        return dispatchOneShotWithRetry(
          searchParameters,
          namespace,
          controller.signal,
        );
      })
      .finally(() => {
        created.settled = true;
        if (slotHeld) {
          releaseDispatchSlot();
        }
        if (IN_FLIGHT_SEARCHES.get(sharedKey) === created) {
          IN_FLIGHT_SEARCHES.delete(sharedKey);
        }
      });
    // The consumer promises below observe and propagate failures. This extra
    // observer prevents an unhandled rejection if every consumer aborts before
    // the shared request finishes cancelling.
    created.promise.catch(() => {});
    IN_FLIGHT_SEARCHES.set(sharedKey, created);
    inFlight = created;
  } else {
    inFlight.priority = Math.min(inFlight.priority, normalizedPriority);
    inFlight.promotePriority?.(normalizedPriority);
    canvasDebug("[search/dispatch] coalesced", {
      tag: tag || null,
      appContext: resolvedAppContext,
      spl: splFingerprint(spl),
      consumers: inFlight.consumerCount + 1,
    });
    canvasTrace("JOINED EXISTING JOB", {
      id: inFlight.diagnosticId,
      search: searchLabel,
      primarySearch: inFlight.primaryTag,
      stage,
      consumers: inFlight.consumerCount + 1,
    });
  }

  return consumeInFlightSearch(inFlight, signal)
    .then((response) => {
      const completedAt = Date.now();
      const rowCount =
        (response && response.results && response.results.length) || 0;
      canvasDebug("[search/dispatch] resolved", {
        tag: tag || null,
        appContext: resolvedAppContext,
        rowCount,
      });
      canvasTrace(rowCount === 0 ? "NO DATA" : "COMPLETED", {
        id: inFlight.diagnosticId,
        search: searchLabel,
        stage,
        rows: rowCount,
        queueWaitMs: inFlight.startedAt
          ? elapsedMs(inFlight.enqueuedAt, inFlight.startedAt)
          : elapsedMs(inFlight.enqueuedAt, completedAt),
        runMs: inFlight.startedAt
          ? elapsedMs(inFlight.startedAt, completedAt)
          : 0,
        totalMs: elapsedMs(requestEnqueuedAt, completedAt),
      });
      return { results: (response && response.results) || [] };
    })
    .catch((err) => {
      if (isAbortError(err)) {
        canvasDebug("[search/dispatch] rejected", {
          tag: tag || null,
          aborted: true,
        });
        canvasTrace("ABORTED", {
          id: inFlight.diagnosticId,
          search: searchLabel,
          stage,
          totalMs: elapsedMs(requestEnqueuedAt),
        });
        throw err;
      }
      const status =
        err instanceof SearchDispatchError ? err.httpStatus : undefined;
      if (shouldCacheSplFailure(status)) {
        FAILED_SPL_CACHE.add(key);
      }
      const classified = classifySearchDispatchError(err);
      const tagLabel = tag || "splunk-search";
      canvasDebug("[search/dispatch] rejected", {
        tag: tagLabel,
        appContext: resolvedAppContext,
        aborted: false,
        httpStatus: classified.httpStatus ?? status,
        reason: classified.reason,
      });
      canvasTrace("FAILED", {
        id: inFlight.diagnosticId,
        search: searchLabel,
        stage,
        httpStatus: classified.httpStatus ?? status ?? "none",
        reason: classified.reason,
        message: classified.message,
        queueWaitMs: inFlight.startedAt
          ? elapsedMs(inFlight.enqueuedAt, inFlight.startedAt)
          : elapsedMs(inFlight.enqueuedAt),
        runMs: inFlight.startedAt ? elapsedMs(inFlight.startedAt) : 0,
        totalMs: elapsedMs(requestEnqueuedAt),
      });
      console.error(
        `[splunkSearchService] dispatch failed tag=${tagLabel} appContext=${resolvedAppContext} ` +
          `httpStatus=${classified.httpStatus ?? status ?? "none"} reason=${classified.reason} ` +
          `message=${classified.message}`,
      );
      throw err instanceof SearchDispatchError
        ? err
        : new SearchDispatchError(classified.message, {
            httpStatus: status,
            kind:
              classified.reason === "job_failed"
                ? "job_failed"
                : "dispatch_failed",
            retryable: false,
          });
    });
};

export const SPL = Object.freeze({
  DEVICES:
    "search index=cisco sourcetype=cisco:syslog | stats latest(status) as status by hostname, model, site, uptime_days",
  BANDWIDTH:
    "search index=cisco sourcetype=cisco:netflow | timechart sum(in_bytes) as inbound_mbps sum(out_bytes) as outbound_mbps",
  SECURITY_ALERTS:
    "search index=cisco sourcetype=cisco:asa OR sourcetype=cisco:ftd severity=* | table _time severity signature src_ip device",
  CPU: "search index=cisco sourcetype=cisco:snmp | stats avg(cpu_pct) as cpu_pct by hostname",
});
