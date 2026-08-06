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
 * from UI input. One stanza is read on workspace load and one debounced upsert
 * is issued after edits; there is no polling or cross-user enumeration.
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

interface ConfRestEntry {
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

export const loadSignalTickerPreference = async (
    workspaceId: WorkspaceId
): Promise<SignalTickerPreferenceLoadResult> => {
    const owner = getSignalTickerPreferenceOwner();
    if (!isInSplunkRuntime() || !owner) {
        return { available: false, patch: null };
    }

    const name = stanzaName(workspaceId);
    const response = await fetchWithBoundedRetry(
        `${buildBaseUrl(owner)}/${encodeURIComponent(name)}?output_mode=json`,
        {
            method: 'GET',
            credentials: 'include',
            headers: { Accept: 'application/json' },
        }
    );
    if (response.status === 404) return { available: true, patch: null };
    if (!response.ok) {
        throw new SignalTickerPreferenceError(
            await extractErrorMessage(
                response,
                "Couldn't load your Signal Rail preferences"
            ),
            response.status
        );
    }

    const json = (await response.json()) as { entry?: ConfRestEntry[] };
    const content = json.entry?.[0]?.content ?? {};
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
    const updateUrl = `${buildBaseUrl(owner)}/${encodeURIComponent(name)}`;
    let response = await fetch(updateUrl, postInit);
    if (response.ok) return true;

    if (response.status === 404) {
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
        if (response.ok) return true;

        // Two tabs can both observe a missing stanza. If the other tab wins
        // the create race, retry the idempotent update exactly once.
        if (response.status === 409) {
            const retry = await fetch(updateUrl, postInit);
            if (retry.ok) return true;
            response = retry;
        }
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
    const response = await fetch(
        `${buildBaseUrl(owner)}/${encodeURIComponent(name)}?output_mode=json`,
        createFetchInit({
            method: 'DELETE',
            headers: { Accept: 'application/json' },
        })
    );
    if (response.ok || response.status === 404) return true;
    throw new SignalTickerPreferenceError(
        await extractErrorMessage(
            response,
            "Couldn't reset your Signal Rail preferences"
        ),
        response.status
    );
};
