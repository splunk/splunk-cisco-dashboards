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
 *   - write REST:      servicesNS/nobody/<app>/configs/conf-customer_topology
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
const STANZA_NAME = 'overview_customer_connectivity';
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

let mockPayload: SavedCustomerTopologyPayload | null = null;

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
    for (const id of CUSTOMER_TOPOLOGY_SECTION_IDS) {
        const value = source[id];
        if (typeof value !== 'string') continue;
        const trimmed = value.trim().replace(/\s+/g, ' ');
        next[id] = trimmed ? trimmed.slice(0, 48) : fallback[id];
    }
    return next;
};

const sanitizePayload = (raw: unknown): SavedCustomerTopologyPayload | null => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const payload = raw as Partial<SavedCustomerTopologyPayload>;
    if (!payload.topology || typeof payload.topology !== 'object') return null;
    return {
        version:
            typeof payload.version === 'number'
                ? payload.version
                : PAYLOAD_VERSION,
        topology: payload.topology as CustomerTopology,
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

const readDevPayload = (): SavedCustomerTopologyPayload | null => {
    if (typeof window === 'undefined') return mockPayload;
    try {
        const raw = window.localStorage.getItem(DEV_STORAGE_KEY);
        if (!raw) return mockPayload;
        return sanitizePayload(JSON.parse(raw));
    } catch {
        return mockPayload;
    }
};

const writeDevPayload = (payload: SavedCustomerTopologyPayload): void => {
    mockPayload = payload;
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(payload));
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

const fetchRow = async (): Promise<CustomerTopologyRow | null> => {
    if (!isInSplunkRuntime()) {
        const payload = readDevPayload();
        if (!payload) return null;
        return {
            name: STANZA_NAME,
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
    const entry = entries.find((candidate) => candidate.name === STANZA_NAME);
    if (!entry) return null;
    return coerceRow(STANZA_NAME, entry.content ?? {});
};

export const loadCustomerTopologyConfig =
    async (): Promise<SavedCustomerTopologyPayload | null> => {
        const row = await fetchRow();
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
    payload: SavedCustomerTopologyPayload
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
    if (payloadJson.length > MAX_PAYLOAD_BYTES) {
        throw new CustomerTopologyPersistenceError(
            `Customer topology is too large to save (${Math.round(
                payloadJson.length / 1024
            )} KiB; cap is ${Math.round(MAX_PAYLOAD_BYTES / 1024)} KiB).`
        );
    }

    if (!isInSplunkRuntime()) {
        writeDevPayload(safePayload);
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

    const updateUrl = `${buildBaseUrl(appName, true)}/${encodeURIComponent(
        STANZA_NAME
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
        createBody.set('name', STANZA_NAME);
        const createInit = buildMutationInit(createBody);
        const createResponse = await withRetry(() =>
            fetch(buildBaseUrl(appName, true), createInit)
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
