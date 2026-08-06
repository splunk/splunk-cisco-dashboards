/**
 * Authenticated, per-user persistence for Signal Rail preferences.
 *
 * Shared defaults remain in insights_workspaces.conf. This service writes only
 * a sparse delta for one workspace into the current Splunk user's namespace:
 *
 *   servicesNS/<current-user>/splunk-cisco-dashboards/
 *     configs/conf-insights_workspace_preferences
 *
 * The username is derived from Splunk's runtime context and is never accepted
 * from UI input. One filtered collection lookup runs on workspace load and one
 * debounced write is issued after edits; there is no polling or cross-user
 * enumeration. Known stanza presence is retained for the current page so an
 * absent private override is a successful empty lookup rather than an expected
 * 404 response.
 */

import { createFetchInit } from '@splunk/splunk-utils/fetch';

import { isWorkspaceId, type WorkspaceId } from '@/common/config/insightsWorkspaces';
import {
    sanitizeSignalTickerPreferencePatch,
    type SignalTickerPreferencePatch,
} from '@/common/config/signalTicker';

const APP_NAME = 'splunk-cisco-dashboards';
export const SIGNAL_TICKER_PREFERENCES_CONF_BASENAME =
    'insights_workspace_preferences';
const STANZA_PREFIX = 'signal_rail.';
const SCHEMA_VERSION = 1;
const MAX_PREFERENCE_JSON_CHARS = 65_536;
const stanzaPresence = new Map<string, boolean>();

interface ConfRestEntry {
    name?: string;
    content?: Record<string, unknown>;
}

export interface SignalTickerPreferenceLoadResult {
    available: boolean;
    patch: SignalTickerPreferencePatch | null;
}

export class SignalTickerPreferenceError extends Error {
    status?: number;

    constructor(message: string, status?: number) {
        super(message);
        this.name = 'SignalTickerPreferenceError';
        this.status = status;
    }
}

const isInSplunkRuntime = (): boolean => {
    if (typeof window === 'undefined') return false;
    const runtime = window as unknown as {
        __SPLUNK_RUNTIME__?: boolean;
        $C?: unknown;
    };
    if (runtime.__SPLUNK_RUNTIME__ === false) return false;
    if (runtime.__SPLUNK_RUNTIME__ === true) return true;
    return (
        Boolean(runtime.$C) ||
        Boolean(document.cookie?.includes('splunkweb_csrf_token'))
    );
};

export const getSignalTickerPreferenceOwner = (): string | null => {
    if (typeof window === 'undefined') return null;
    const $C = (window as unknown as { $C?: Record<string, unknown> }).$C;
    const username = $C?.USERNAME;
    return typeof username === 'string' && username.trim()
        ? username.trim()
        : null;
};

const stanzaName = (workspaceId: WorkspaceId): string => {
    if (!isWorkspaceId(workspaceId)) {
        throw new SignalTickerPreferenceError(
            `Invalid Insights workspace ID "${workspaceId}".`
        );
    }
    return `${STANZA_PREFIX}${workspaceId}`;
};

const buildBaseUrl = (owner: string): string =>
    `/en-US/splunkd/__raw/servicesNS/${encodeURIComponent(owner)}/${APP_NAME}/configs/conf-${SIGNAL_TICKER_PREFERENCES_CONF_BASENAME}`;

const stanzaPresenceKey = (owner: string, name: string): string =>
    `${owner}\u0000${name}`;

const buildLookupUrl = (owner: string, name: string): string => {
    const query = new URLSearchParams({
        output_mode: 'json',
        count: '1',
        search: `name="${name}"`,
    });
    return `${buildBaseUrl(owner)}?${query.toString()}`;
};

const extractErrorMessage = async (
    response: Response,
    fallback: string
): Promise<string> => {
    try {
        const body = (await response.json()) as {
            messages?: Array<{ text?: string }>;
        };
        const detail = Array.isArray(body.messages)
            ? body.messages
                  .map((message) =>
                      typeof message?.text === 'string' ? message.text : ''
                  )
                  .filter(Boolean)
                  .join('; ')
            : '';
        return detail
            ? `${fallback}: ${detail}`
            : `${fallback}: HTTP ${response.status}`;
    } catch {
        return `${fallback}: HTTP ${response.status}`;
    }
};

const fetchWithBoundedRetry = async (
    url: string,
    init: RequestInit
): Promise<Response> => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            const response = await fetch(url, init);
            if (response.status < 500 || attempt === 1) return response;
            lastError = new Error(`HTTP ${response.status}`);
        } catch (error) {
            lastError = error;
        }
        await new Promise<void>((resolve) => {
            window.setTimeout(resolve, 200 + attempt * 400);
        });
    }
    throw lastError;
};

const lookupPreferenceEntry = async (
    owner: string,
    name: string,
    errorMessage: string
): Promise<ConfRestEntry | null> => {
    const response = await fetchWithBoundedRetry(buildLookupUrl(owner, name), {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
        throw new SignalTickerPreferenceError(
            await extractErrorMessage(response, errorMessage),
            response.status
        );
    }

    const json = (await response.json()) as { entry?: ConfRestEntry[] };
    const entry =
        json.entry?.find((candidate) => candidate.name === name) ?? null;
    stanzaPresence.set(stanzaPresenceKey(owner, name), Boolean(entry));
    return entry;
};

const preferenceStanzaExists = async (
    owner: string,
    name: string
): Promise<boolean> => {
    const key = stanzaPresenceKey(owner, name);
    const knownPresence = stanzaPresence.get(key);
    if (knownPresence !== undefined) return knownPresence;
    return Boolean(
        await lookupPreferenceEntry(
            owner,
            name,
            "Couldn't check your Signal Rail preferences"
        )
    );
};

export const loadSignalTickerPreference = async (
    workspaceId: WorkspaceId
): Promise<SignalTickerPreferenceLoadResult> => {
    const owner = getSignalTickerPreferenceOwner();
    if (!isInSplunkRuntime() || !owner) {
        return { available: false, patch: null };
    }

    const name = stanzaName(workspaceId);
    const entry = await lookupPreferenceEntry(
        owner,
        name,
        "Couldn't load your Signal Rail preferences"
    );
    if (!entry) return { available: true, patch: null };

    const content = entry.content ?? {};
    const rawJson = content.preferences_json;
    if (typeof rawJson !== 'string' || !rawJson.trim()) {
        return { available: true, patch: null };
    }
    if (rawJson.length > MAX_PREFERENCE_JSON_CHARS) {
        throw new SignalTickerPreferenceError(
            'Your saved Signal Rail preferences exceed the supported size.'
        );
    }

    try {
        const patch = sanitizeSignalTickerPreferencePatch(JSON.parse(rawJson));
        if (!patch) {
            throw new Error('invalid preference object');
        }
        return { available: true, patch };
    } catch (error) {
        throw new SignalTickerPreferenceError(
            `Your saved Signal Rail preferences are invalid: ${
                error instanceof Error ? error.message : String(error)
            }`
        );
    }
};

const preferenceFields = (
    patch: SignalTickerPreferencePatch,
    owner: string
): URLSearchParams => {
    const preferencesJson = JSON.stringify(patch);
    if (preferencesJson.length > MAX_PREFERENCE_JSON_CHARS) {
        throw new SignalTickerPreferenceError(
            'Signal Rail preferences exceed the supported size.'
        );
    }
    return new URLSearchParams({
        schema_version: String(SCHEMA_VERSION),
        preferences_json: preferencesJson,
        updated_at: new Date().toISOString(),
        updated_by: owner,
        output_mode: 'json',
    });
};

export const saveSignalTickerPreference = async (
    workspaceId: WorkspaceId,
    patch: SignalTickerPreferencePatch
): Promise<boolean> => {
    const owner = getSignalTickerPreferenceOwner();
    if (!isInSplunkRuntime() || !owner) return false;

    const name = stanzaName(workspaceId);
    const fields = preferenceFields(patch, owner);
    const postInit = createFetchInit({
        method: 'POST',
        body: fields.toString(),
        headers: { Accept: 'application/json' },
    });
    const key = stanzaPresenceKey(owner, name);
    const updateUrl = `${buildBaseUrl(owner)}/${encodeURIComponent(name)}`;
    const exists = await preferenceStanzaExists(owner, name);
    let response: Response;

    if (exists) {
        response = await fetch(updateUrl, postInit);
        if (response.ok) {
            stanzaPresence.set(key, true);
            return true;
        }

        // Another tab may have reset the stanza after this tab loaded it.
        // Fall through to one create attempt if that rare race is observed.
        if (response.status !== 404) {
            throw new SignalTickerPreferenceError(
                await extractErrorMessage(
                    response,
                    "Couldn't save your Signal Rail preferences"
                ),
                response.status
            );
        }
        stanzaPresence.set(key, false);
    }

    const createFields = new URLSearchParams(fields);
    createFields.set('name', name);
    response = await fetch(
        buildBaseUrl(owner),
        createFetchInit({
            method: 'POST',
            body: createFields.toString(),
            headers: { Accept: 'application/json' },
        })
    );
    if (response.ok) {
        stanzaPresence.set(key, true);
        return true;
    }

    // Two tabs can both observe a missing stanza. If the other tab wins the
    // create race, retry the idempotent update exactly once.
    if (response.status === 409) {
        const retry = await fetch(updateUrl, postInit);
        if (retry.ok) {
            stanzaPresence.set(key, true);
            return true;
        }
        response = retry;
    }

    throw new SignalTickerPreferenceError(
        await extractErrorMessage(
            response,
            "Couldn't save your Signal Rail preferences"
        ),
        response.status
    );
};

export const deleteSignalTickerPreference = async (
    workspaceId: WorkspaceId
): Promise<boolean> => {
    const owner = getSignalTickerPreferenceOwner();
    if (!isInSplunkRuntime() || !owner) return false;

    const name = stanzaName(workspaceId);
    const key = stanzaPresenceKey(owner, name);
    if (!(await preferenceStanzaExists(owner, name))) return true;

    const response = await fetch(
        `${buildBaseUrl(owner)}/${encodeURIComponent(name)}?output_mode=json`,
        createFetchInit({
            method: 'DELETE',
            headers: { Accept: 'application/json' },
        })
    );
    if (response.ok || response.status === 404) {
        stanzaPresence.set(key, false);
        return true;
    }
    throw new SignalTickerPreferenceError(
        await extractErrorMessage(
            response,
            "Couldn't reset your Signal Rail preferences"
        ),
        response.status
    );
};
