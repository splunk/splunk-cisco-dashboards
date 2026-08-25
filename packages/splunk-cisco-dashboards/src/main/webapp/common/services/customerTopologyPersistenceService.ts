/**
 * Persistence for the shared customer topology shown on the executive
 * overview page.
 *
 * The topology used to live in browser localStorage, which made every
 * operator's site/link edits private to that browser profile. This service
 * stores the shared version in `customer_topology.conf` instead:
 *
 *   - shipped defaults: default/customer_topology.conf
 *   - operator edits:  local/customer_topology.conf
 *   - read REST:       servicesNS/-/<app>/configs/conf-customer_topology
 *   - write REST:      servicesNS/nobody/<app>/scd_customer_topology
 *
 * Writing as owner `nobody` is intentional: the saved topology is app-wide,
 * so every user with read access to the app sees the same site/link layout.
 */

import { createFetchInit } from '@splunk/splunk-utils/fetch';

import type { CustomerTopology } from '@/common/types';
import {
    ALL_WORKSPACE_SECTION_IDS,
    WORKSPACE_SOURCES,
    type SectionId,
} from '@/common/config/insightsWorkspaces';

import { getSearchAppContext } from './splunkSearchService';

const CONF_BASENAME = 'customer_topology';
const BASE_STANZA_NAME = 'overview_customer_connectivity';
const DEFAULT_TOPOLOGY_ID = 'customer-site-connectivity';
const LEGACY_FACTORY_TOPOLOGY_NAME = 'Customer Site Connectivity';
const LEGACY_FACTORY_TOPOLOGY_SUBTITLE = 'Editable customer site connectivity';
const FACTORY_TOPOLOGY_NAME = 'Secure Network Command Map';
const FACTORY_TOPOLOGY_SUBTITLE =
    'Live sites, trust paths, and policy-enforcement health';
const CURRENT_SCHEMA_VERSION = 1;
const PAYLOAD_VERSION = 1;
const MAX_PAYLOAD_BYTES = 128 * 1024;
const DEV_STORAGE_KEY = 'splunk-cisco-dashboards.customerTopologyConfig.v1';

export const CUSTOMER_TOPOLOGY_SECTION_IDS = ALL_WORKSPACE_SECTION_IDS;

export type CustomerTopologySectionId =
    SectionId;

export type CustomerTopologySectionTitles = Record<
    CustomerTopologySectionId,
    string
>;

export const DEFAULT_CUSTOMER_TOPOLOGY_SECTION_TITLES: CustomerTopologySectionTitles = {
    ...Object.fromEntries(
        Object.values(WORKSPACE_SOURCES).flatMap((profile) =>
            profile.sections.map((section) => [section.id, section.title])
        )
    ),
} as CustomerTopologySectionTitles;

export interface SavedCustomerTopologyPayload {
    version: number;
    topology: CustomerTopology;
    sectionTitles: CustomerTopologySectionTitles;
}

interface CustomerTopologyRow {
    name: string;
    title: string;
    description: string;
    updatedAt: string;
    updatedBy: string;
    schemaVersion: number;
    siteCount: number;
    linkCount: number;
    sectionTitles: string;
    payloadJson: string;
}

interface ConfRestEntry {
    name?: string;
    content?: Record<string, unknown>;
}

const mockPayloadByStanza = new Map<string, SavedCustomerTopologyPayload>();

const stanzaNameForTopology = (topologyId?: string): string => {
    const normalized = (topologyId ?? DEFAULT_TOPOLOGY_ID)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 72);
    return !normalized || normalized === 'customer_site_connectivity'
        ? BASE_STANZA_NAME
        : `${BASE_STANZA_NAME}_${normalized}`;
};

const devStorageKeyForStanza = (stanzaName: string): string =>
    stanzaName === BASE_STANZA_NAME
        ? DEV_STORAGE_KEY
        : `${DEV_STORAGE_KEY}.${stanzaName}`;

class CustomerTopologyPersistenceError extends Error {
    public readonly status?: number;

    constructor(message: string, status?: number) {
        super(message);
        this.name = 'CustomerTopologyPersistenceError';
        this.status = status;
    }
}

const optionalString = (raw: unknown): string =>
    typeof raw === 'string' ? raw : '';

const optionalInt = (raw: unknown): number | undefined => {
    if (raw === undefined || raw === null) return undefined;
    const value = Number.parseInt(String(raw), 10);
    return Number.isFinite(value) && value >= 0 ? value : undefined;
};

export const sanitizeCustomerTopologySectionTitles = (
    raw: unknown,
    fallback: CustomerTopologySectionTitles = DEFAULT_CUSTOMER_TOPOLOGY_SECTION_TITLES
): CustomerTopologySectionTitles => {
    const source =
        raw && typeof raw === 'object' && !Array.isArray(raw)
            ? (raw as Partial<Record<CustomerTopologySectionId, unknown>>)
            : {};
    const next: CustomerTopologySectionTitles = { ...fallback };
    const legacyFactoryTitles: Partial<Record<CustomerTopologySectionId, string>> = {
        it_health: 'IT Health',
        security: 'Security',
        building: 'Building Intelligence',
        custom: 'Executive Signals',
    };
    for (const id of CUSTOMER_TOPOLOGY_SECTION_IDS) {
        const value = source[id];
        if (typeof value !== 'string') continue;
        const trimmed = value.trim().replace(/\s+/g, ' ');
        next[id] =
            trimmed && trimmed !== legacyFactoryTitles[id]
                ? trimmed.slice(0, 48)
                : fallback[id];
    }
    return next;
};

const sanitizePayload = (raw: unknown): SavedCustomerTopologyPayload | null => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const payload = raw as Partial<SavedCustomerTopologyPayload>;
    if (!payload.topology || typeof payload.topology !== 'object') return null;
    const topology = payload.topology as CustomerTopology;
    const isLegacyFactoryTopology = topology.id === DEFAULT_TOPOLOGY_ID;
    const migratedTopology = isLegacyFactoryTopology
        ? {
              ...topology,
              name:
                  topology.name === LEGACY_FACTORY_TOPOLOGY_NAME
                      ? FACTORY_TOPOLOGY_NAME
                      : topology.name,
              subtitle:
                  topology.subtitle === LEGACY_FACTORY_TOPOLOGY_SUBTITLE
                      ? FACTORY_TOPOLOGY_SUBTITLE
                      : topology.subtitle,
          }
        : topology;
    return {
        version:
            typeof payload.version === 'number'
                ? payload.version
                : PAYLOAD_VERSION,
        topology: migratedTopology,
        sectionTitles: sanitizeCustomerTopologySectionTitles(
            payload.sectionTitles
        ),
    };
};

const isInSplunkRuntime = (): boolean => {
    if (typeof window === 'undefined') return false;
    const runtime = window as unknown as { __SPLUNK_RUNTIME__?: boolean; $C?: unknown };
    if (runtime.__SPLUNK_RUNTIME__ === false) return false;
    if (runtime.__SPLUNK_RUNTIME__ === true) return true;
    return Boolean(runtime.$C) || Boolean(document.cookie?.includes('splunkweb_csrf_token'));
};

const getCsrfToken = (): string | null => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
        return null;
    }
    const runtime = window as unknown as { $C?: Record<string, unknown> };
    const bootstrapToken =
        runtime.$C?.FORM_KEY ??
        runtime.$C?.form_key ??
        runtime.$C?.SPLUNKWEB_CSRF_TOKEN ??
        runtime.$C?.csrf_token;
    if (typeof bootstrapToken === 'string' && bootstrapToken.trim()) {
        return bootstrapToken.trim();
    }
    const match = document.cookie.match(
        /(?:^|;\s*)splunkweb_csrf_token(?:_[^=;]+)?=([^;]+)/
    );
    return match ? decodeURIComponent(match[1]) : null;
};

const buildMutationInit = (body: URLSearchParams): RequestInit => {
    const init = createFetchInit({
        method: 'POST',
        body: body.toString(),
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
    });
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    headers.set('Content-Type', 'application/x-www-form-urlencoded');
    headers.set('X-Requested-With', 'XMLHttpRequest');
    const csrf = getCsrfToken();
    if (csrf && !headers.has('X-Splunk-Form-Key')) {
        headers.set('X-Splunk-Form-Key', csrf);
    }
    return {
        ...init,
        headers,
    };
};

const getCurrentUser = (): string => {
    if (typeof window === 'undefined') return 'unknown';
    const $C = (window as unknown as { $C?: Record<string, unknown> }).$C;
    const username = $C?.USERNAME;
    return typeof username === 'string' && username.trim()
        ? username.trim()
        : 'unknown';
};

const buildBaseUrl = (appName: string, forWrite: boolean): string => {
    const owner = forWrite ? 'nobody' : '-';
    return `/en-US/splunkd/__raw/servicesNS/${owner}/${encodeURIComponent(
        appName
    )}/configs/conf-${CONF_BASENAME}`;
};

const buildMutationBaseUrl = (appName: string): string =>
    `/en-US/splunkd/__raw/servicesNS/nobody/${encodeURIComponent(
        appName
    )}/scd_customer_topology`;

const friendlyMessage = (
    status: number,
    body: unknown,
    verb: string
): string => {
    const messages = Array.isArray(
        (body as { messages?: Array<{ text?: string }> })?.messages
    )
        ? (body as { messages: Array<{ text?: string }> }).messages
        : [];
    const detail = messages
        .map((message) =>
            typeof message?.text === 'string' ? message.text : ''
        )
        .filter(Boolean)
        .join('; ');
    if (status === 401 || status === 403) {
        const looksLikeCsrf =
            /csrf/i.test(detail) ||
            (status === 401 && getCsrfToken() === null);
        if (looksLikeCsrf) {
            return `Couldn't ${verb}: Splunk session token is stale or missing${
                detail ? ` - ${detail}` : ''
            }. Reload the page to refresh the CSRF cookie, then try again.`;
        }
        return `Couldn't ${verb}: authentication or authorization failed${
            detail ? ` - ${detail}` : ''
        }. Check write access to customer_topology.conf.`;
    }
    return detail ? `Couldn't ${verb}: ${detail}` : `Couldn't ${verb}: HTTP ${status}.`;
};

const withRetry = async <T>(fn: () => Promise<T>): Promise<T> => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (attempt < 2) {
                await new Promise<void>((resolve) => {
                    setTimeout(resolve, attempt === 0 ? 250 : 750);
                });
            }
        }
    }
    throw lastError;
};

const readDevPayload = (stanzaName: string): SavedCustomerTopologyPayload | null => {
    const mockPayload = mockPayloadByStanza.get(stanzaName) ?? null;
    if (typeof window === 'undefined') return mockPayload;
    try {
        const raw = window.localStorage.getItem(devStorageKeyForStanza(stanzaName));
        if (!raw) return mockPayload;
        return sanitizePayload(JSON.parse(raw));
    } catch {
        return mockPayload;
    }
};

const writeDevPayload = (
    stanzaName: string,
    payload: SavedCustomerTopologyPayload
): void => {
    mockPayloadByStanza.set(stanzaName, payload);
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(
            devStorageKeyForStanza(stanzaName),
            JSON.stringify(payload)
        );
    } catch {
        // Storage can be unavailable in private mode. The module-level
        // mock still keeps the current page session working.
    }
};

const coerceRow = (
    name: string,
    content: Record<string, unknown>
): CustomerTopologyRow => ({
    name,
    title: optionalString(content.title),
    description: optionalString(content.description),
    updatedAt: optionalString(content.updated_at),
    updatedBy: optionalString(content.updated_by),
    schemaVersion: optionalInt(content.schema_version) ?? 1,
    siteCount: optionalInt(content.site_count) ?? 0,
    linkCount: optionalInt(content.link_count) ?? 0,
    sectionTitles: optionalString(content.section_titles),
    payloadJson: optionalString(content.payload_json),
});

const fetchRow = async (stanzaName: string): Promise<CustomerTopologyRow | null> => {
    if (!isInSplunkRuntime()) {
        const payload = readDevPayload(stanzaName);
        if (!payload) return null;
        return {
            name: stanzaName,
            title: payload.topology.name,
            description: payload.topology.subtitle,
            updatedAt: '',
            updatedBy: 'dev',
            schemaVersion: CURRENT_SCHEMA_VERSION,
            siteCount: payload.topology.sites.length,
            linkCount: payload.topology.links.length,
            sectionTitles: JSON.stringify(payload.sectionTitles),
            payloadJson: JSON.stringify(payload),
        };
    }

    const appName = getSearchAppContext();
    const headers: Record<string, string> = { Accept: 'application/json' };
    const csrf = getCsrfToken();
    if (csrf) headers['X-Splunk-Form-Key'] = csrf;
    const url = `${buildBaseUrl(appName, false)}?output_mode=json&count=0`;

    let response: Response;
    try {
        response = await withRetry(() =>
            fetch(url, {
                method: 'GET',
                credentials: 'include',
                headers,
            })
        );
    } catch (error) {
        throw new CustomerTopologyPersistenceError(
            `Couldn't load customer topology: ${
                error instanceof Error ? error.message : String(error)
            }`
        );
    }

    if (!response.ok) {
        let body: unknown = null;
        try {
            body = await response.json();
        } catch {
            // ignore parse failure
        }
        throw new CustomerTopologyPersistenceError(
            friendlyMessage(response.status, body, 'load customer topology'),
            response.status
        );
    }

    const json = (await response.json()) as { entry?: ConfRestEntry[] };
    const entries = Array.isArray(json.entry) ? json.entry : [];
    const entry = entries.find((candidate) => candidate.name === stanzaName);
    if (!entry) return null;
    return coerceRow(stanzaName, entry.content ?? {});
};

export const loadCustomerTopologyConfig =
    async (topologyId?: string): Promise<SavedCustomerTopologyPayload | null> => {
        const row = await fetchRow(stanzaNameForTopology(topologyId));
        if (!row?.payloadJson) return null;
        let parsedPayload: unknown = null;
        try {
            parsedPayload = JSON.parse(row.payloadJson);
        } catch {
            parsedPayload = null;
        }
        const payload = sanitizePayload(parsedPayload);
        if (payload) return payload;
        return null;
    };

export const saveCustomerTopologyConfig = async (
    payload: SavedCustomerTopologyPayload,
    expectedPayload?: SavedCustomerTopologyPayload,
): Promise<void> => {
    const safePayload = sanitizePayload({
        ...payload,
        version: PAYLOAD_VERSION,
        sectionTitles: sanitizeCustomerTopologySectionTitles(payload.sectionTitles),
    });
    if (!safePayload) {
        throw new CustomerTopologyPersistenceError(
            'Customer topology payload is malformed.'
        );
    }
    const payloadJson = JSON.stringify(safePayload);
    const stanzaName = stanzaNameForTopology(safePayload.topology.id);
    if (payloadJson.length > MAX_PAYLOAD_BYTES) {
        throw new CustomerTopologyPersistenceError(
            `Customer topology is too large to save (${Math.round(
                payloadJson.length / 1024
            )} KiB; cap is ${Math.round(MAX_PAYLOAD_BYTES / 1024)} KiB).`
        );
    }

    const safeExpectedPayload = expectedPayload
        ? sanitizePayload(expectedPayload)
        : null;

    if (safeExpectedPayload) {
        const currentRow = await fetchRow(stanzaName);
        if (currentRow?.payloadJson) {
            let currentRaw: unknown = null;
            try {
                currentRaw = JSON.parse(currentRow.payloadJson);
            } catch {
                currentRaw = null;
            }
            const currentPayload = sanitizePayload(currentRaw);
            if (
                !currentPayload ||
                JSON.stringify(currentPayload) !==
                    JSON.stringify(safeExpectedPayload)
            ) {
                throw new CustomerTopologyPersistenceError(
                    'The shared topology changed after this page loaded. Reload and review the latest version before saving.',
                    409,
                );
            }
        }
    }

    if (!isInSplunkRuntime()) {
        writeDevPayload(stanzaName, safePayload);
        return;
    }

    const appName = getSearchAppContext();
    const body = new URLSearchParams({
        schema_version: String(CURRENT_SCHEMA_VERSION),
        title: safePayload.topology.name,
        description: safePayload.topology.subtitle,
        updated_at: new Date().toISOString(),
        updated_by: getCurrentUser(),
        site_count: String(safePayload.topology.sites.length),
        link_count: String(safePayload.topology.links.length),
        section_titles: JSON.stringify(safePayload.sectionTitles),
        payload_json: payloadJson,
        output_mode: 'json',
    });
    const postInit = buildMutationInit(body);

    const updateUrl = `${buildMutationBaseUrl(appName)}/${encodeURIComponent(
        stanzaName
    )}`;
    let response: Response;
    try {
        response = await withRetry(() =>
            fetch(updateUrl, postInit)
        );
    } catch (error) {
        throw new CustomerTopologyPersistenceError(
            `Couldn't save customer topology: ${
                error instanceof Error ? error.message : String(error)
            }`
        );
    }
    if (response.ok) return;

    if (response.status === 404) {
        const createBody = new URLSearchParams(body);
        createBody.set('name', stanzaName);
        const createInit = buildMutationInit(createBody);
        const createResponse = await withRetry(() =>
            fetch(buildMutationBaseUrl(appName), createInit)
        );
        if (createResponse.ok) return;
        let createError: unknown = null;
        try {
            createError = await createResponse.json();
        } catch {
            // ignore parse failure
        }
        throw new CustomerTopologyPersistenceError(
            friendlyMessage(createResponse.status, createError, 'save customer topology'),
            createResponse.status
        );
    }

    let errorBody: unknown = null;
    try {
        errorBody = await response.json();
    } catch {
        // ignore parse failure
    }
    throw new CustomerTopologyPersistenceError(
        friendlyMessage(response.status, errorBody, 'save customer topology'),
        response.status
    );
};
