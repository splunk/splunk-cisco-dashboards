/**
 * Persistence for Searchbase Canvas layouts.
 *
 * Mirrors the Network Diagram persistence model: one stanza per saved
 * canvas in `searchbase_canvases.conf`, default + local layering, writes
 * through Splunk's public conf REST endpoint.
 */

import { createFetchInit } from '@splunk/splunk-utils/fetch';

import { getSearchAppContext } from './splunkSearchService';

const CONF_BASENAME = 'searchbase_canvases';
const CURRENT_SCHEMA_VERSION = 1;
const PAYLOAD_VERSION = 1;
const MAX_PAYLOAD_BYTES = 128 * 1024;
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _.\-]{0,63}$/;
const PAGE_SIZES = new Set([10, 25, 50, 100]);

type TileSpan = 1 | 2 | 4;
type PageSize = 10 | 25 | 50 | 100;

export interface SavedSearchbaseCanvasTile {
    id: string;
    searchName: string;
    span: TileSpan;
    addedAt: number;
    vizOverride?: string;
    overlayField?: string | null;
}

export interface SavedSearchbaseCanvasPayload {
    version: number;
    canvasName: string;
    pageSize: PageSize;
    rangeLabel: string;
    tiles: SavedSearchbaseCanvasTile[];
}

export interface SearchbaseCanvasSummary {
    name: string;
    title: string;
    description: string;
    updatedAt: string;
    updatedBy: string;
    schemaVersion: number;
    tileCount: number;
    pageSize: PageSize;
    searchNames: string;
    hasLocalOverride: boolean;
}

interface CanvasRow extends SearchbaseCanvasSummary {
    payloadJson: string;
}

interface ConfRestEntry {
    name?: string;
    content?: Record<string, unknown>;
    acl?: {
        removable?: boolean;
        [key: string]: unknown;
    };
}

const MOCK_STORE = new Map<string, CanvasRow>();

class SearchbaseCanvasPersistenceError extends Error {
    public readonly status?: number;

    constructor(message: string, status?: number) {
        super(message);
        this.name = 'SearchbaseCanvasPersistenceError';
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

const isTileSpan = (value: unknown): value is TileSpan =>
    value === 1 || value === 2 || value === 4;

const isPageSize = (value: unknown): value is PageSize =>
    PAGE_SIZES.has(Number(value));

const normalizeVizOverride = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim().toLowerCase();
    if (!trimmed || !trimmed.startsWith('splunk.')) return undefined;
    return trimmed.slice(0, 64);
};

const SAFE_FIELD_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_.:]{0,127}$/;

const normalizeOverlayField = (value: unknown): string | null | undefined => {
    if (value === null) return null;
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return SAFE_FIELD_NAME_PATTERN.test(trimmed) ? trimmed : undefined;
};

const assertValidName = (name: string): void => {
    if (typeof name !== 'string' || !NAME_PATTERN.test(name.trim())) {
        throw new SearchbaseCanvasPersistenceError(
            'Canvas name must be 1-64 characters and use letters, numbers, spaces, dots, hyphens, or underscores.'
        );
    }
};

const isInSplunkRuntime = (): boolean => {
    if (typeof window === 'undefined') return false;
    const runtime = window as unknown as { __SPLUNK_RUNTIME__?: boolean; $C?: unknown };
    if (runtime.__SPLUNK_RUNTIME__ === false) return false;
    if (runtime.__SPLUNK_RUNTIME__ === true) return true;
    return Boolean(runtime.$C) || Boolean(document.cookie?.includes('splunkweb_csrf_token'));
};

const getCsrfToken = (): string | null => {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(/(?:^|;\s*)splunkweb_csrf_token_\w+=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
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
        return `Couldn't ${verb}: authentication or authorization failed${
            detail ? ` - ${detail}` : ''
        }.`;
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

const sanitizePayload = (raw: unknown): SavedSearchbaseCanvasPayload => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new SearchbaseCanvasPersistenceError('Saved canvas payload is malformed.');
    }
    const payload = raw as Partial<SavedSearchbaseCanvasPayload>;
    const pageSize = isPageSize(payload.pageSize) ? payload.pageSize : 25;
    const tiles = Array.isArray(payload.tiles)
        ? payload.tiles.flatMap((tile): SavedSearchbaseCanvasTile[] => {
              if (!tile || typeof tile !== 'object') return [];
              const candidate = tile as Partial<SavedSearchbaseCanvasTile>;
              if (
                  typeof candidate.id !== 'string' ||
                  typeof candidate.searchName !== 'string'
              ) {
                  return [];
              }
              return [
                  {
                      id: candidate.id.slice(0, 128),
                      searchName: candidate.searchName.slice(0, 256),
                      span: isTileSpan(candidate.span) ? candidate.span : 1,
                      addedAt:
                          typeof candidate.addedAt === 'number'
                              ? candidate.addedAt
                              : Date.now(),
                      vizOverride: normalizeVizOverride(candidate.vizOverride),
                      overlayField: normalizeOverlayField(candidate.overlayField),
                  },
              ];
          })
        : [];

    return {
        version:
            typeof payload.version === 'number'
                ? payload.version
                : PAYLOAD_VERSION,
        canvasName:
            typeof payload.canvasName === 'string' && payload.canvasName.trim()
                ? payload.canvasName.trim().slice(0, 96)
                : 'Searchbase Canvas',
        pageSize,
        rangeLabel:
            typeof payload.rangeLabel === 'string' && payload.rangeLabel.trim()
                ? payload.rangeLabel.trim().slice(0, 80)
                : 'Last 24 hours',
        tiles,
    };
};

const computeSearchNames = (payload: SavedSearchbaseCanvasPayload): string =>
    Array.from(new Set(payload.tiles.map((tile) => tile.searchName.trim())))
        .filter(Boolean)
        .sort()
        .join(',');

const coerceRow = (
    name: string,
    content: Record<string, unknown>,
    hasLocalOverride: boolean
): CanvasRow => {
    const payloadJson = optionalString(content.payload_json);
    let payload: SavedSearchbaseCanvasPayload | null = null;
    if (payloadJson) {
        try {
            payload = sanitizePayload(JSON.parse(payloadJson));
        } catch {
            payload = null;
        }
    }

    const pageSize = optionalInt(content.page_size);
    return {
        name,
        title:
            optionalString(content.title) ||
            payload?.canvasName ||
            name,
        description: optionalString(content.description),
        updatedAt: optionalString(content.updated_at),
        updatedBy: optionalString(content.updated_by),
        schemaVersion: optionalInt(content.schema_version) ?? 1,
        tileCount: optionalInt(content.tile_count) ?? payload?.tiles.length ?? 0,
        pageSize: isPageSize(pageSize) ? pageSize : payload?.pageSize ?? 25,
        searchNames:
            optionalString(content.search_names) ||
            (payload ? computeSearchNames(payload) : ''),
        hasLocalOverride,
        payloadJson,
    };
};

const fetchAllRows = async (): Promise<CanvasRow[]> => {
    if (!isInSplunkRuntime()) {
        return Array.from(MOCK_STORE.values()).sort((a, b) =>
            a.name.localeCompare(b.name)
        );
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
        throw new SearchbaseCanvasPersistenceError(
            `Couldn't load saved canvases: ${
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
        throw new SearchbaseCanvasPersistenceError(
            friendlyMessage(response.status, body, 'load saved canvases'),
            response.status
        );
    }

    const json = (await response.json()) as { entry?: ConfRestEntry[] };
    const entries = Array.isArray(json.entry) ? json.entry : [];
    return entries.flatMap((entry): CanvasRow[] => {
        const name = optionalString(entry.name);
        if (!name || name === 'default' || !NAME_PATTERN.test(name)) return [];
        return [coerceRow(name, entry.content ?? {}, entry.acl?.removable === true)];
    });
};

const upsertRow = async (row: CanvasRow): Promise<void> => {
    if (!isInSplunkRuntime()) {
        MOCK_STORE.set(row.name, row);
        return;
    }

    const appName = getSearchAppContext();

    const body = new URLSearchParams({
        schema_version: String(row.schemaVersion),
        title: row.title,
        description: row.description,
        updated_at: row.updatedAt,
        updated_by: row.updatedBy,
        tile_count: String(row.tileCount),
        page_size: String(row.pageSize),
        search_names: row.searchNames,
        payload_json: row.payloadJson,
        output_mode: 'json',
    });

    const updateUrl = `${buildBaseUrl(appName, true)}/${encodeURIComponent(row.name)}`;
    const postInit = createFetchInit({
        method: 'POST',
        body: body.toString(),
        headers: { Accept: 'application/json' },
    });
    let response: Response;
    try {
        response = await withRetry(() => fetch(updateUrl, postInit));
    } catch (error) {
        throw new SearchbaseCanvasPersistenceError(
            `Couldn't save canvas: ${
                error instanceof Error ? error.message : String(error)
            }`
        );
    }
    if (response.ok) return;

    if (response.status === 404) {
        const createBody = new URLSearchParams(body);
        createBody.set('name', row.name);
        const createInit = createFetchInit({
            method: 'POST',
            body: createBody.toString(),
            headers: { Accept: 'application/json' },
        });
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
        throw new SearchbaseCanvasPersistenceError(
            friendlyMessage(createResponse.status, createError, 'save canvas'),
            createResponse.status
        );
    }

    let errorBody: unknown = null;
    try {
        errorBody = await response.json();
    } catch {
        // ignore parse failure
    }
    throw new SearchbaseCanvasPersistenceError(
        friendlyMessage(response.status, errorBody, 'save canvas'),
        response.status
    );
};

export const listSearchbaseCanvases = async (): Promise<
    SearchbaseCanvasSummary[]
> => {
    const rows = await fetchAllRows();
    return rows
        .map(({ payloadJson, ...summary }) => summary)
        .sort((a, b) => a.name.localeCompare(b.name));
};

export const loadSearchbaseCanvas = async (
    name: string
): Promise<SavedSearchbaseCanvasPayload | null> => {
    const trimmed = name.trim();
    assertValidName(trimmed);
    const rows = await fetchAllRows();
    const row = rows.find((candidate) => candidate.name === trimmed);
    if (!row) return null;
    if (!row.payloadJson) {
        return {
            version: PAYLOAD_VERSION,
            canvasName: row.title || row.name,
            pageSize: row.pageSize,
            rangeLabel: 'Last 24 hours',
            tiles: [],
        };
    }
    return sanitizePayload(JSON.parse(row.payloadJson));
};

export const saveSearchbaseCanvas = async (
    name: string,
    payload: SavedSearchbaseCanvasPayload
): Promise<SearchbaseCanvasSummary> => {
    const trimmed = name.trim();
    assertValidName(trimmed);
    const safePayload = sanitizePayload({
        ...payload,
        version: PAYLOAD_VERSION,
        canvasName: trimmed,
    });
    const payloadJson = JSON.stringify(safePayload);
    if (payloadJson.length > MAX_PAYLOAD_BYTES) {
        throw new SearchbaseCanvasPersistenceError(
            `Canvas is too large to save (${Math.round(
                payloadJson.length / 1024
            )} KiB; cap is ${Math.round(MAX_PAYLOAD_BYTES / 1024)} KiB).`
        );
    }

    const row: CanvasRow = {
        name: trimmed,
        title: safePayload.canvasName,
        description: '',
        updatedAt: new Date().toISOString(),
        updatedBy: getCurrentUser(),
        schemaVersion: CURRENT_SCHEMA_VERSION,
        tileCount: safePayload.tiles.length,
        pageSize: safePayload.pageSize,
        searchNames: computeSearchNames(safePayload),
        hasLocalOverride: true,
        payloadJson,
    };
    await upsertRow(row);
    const { payloadJson: _payloadJson, ...summary } = row;
    return summary;
};

export const deleteSearchbaseCanvas = async (name: string): Promise<void> => {
    const trimmed = name.trim();
    assertValidName(trimmed);
    if (!isInSplunkRuntime()) {
        MOCK_STORE.delete(trimmed);
        return;
    }

    const appName = getSearchAppContext();
    const url = `${buildBaseUrl(appName, true)}/${encodeURIComponent(
        trimmed
    )}?output_mode=json`;
    const deleteInit = createFetchInit({
        method: 'DELETE',
        headers: { Accept: 'application/json' },
    });

    const response = await withRetry(() => fetch(url, deleteInit));
    if (response.ok || response.status === 404) return;
    let body: unknown = null;
    try {
        body = await response.json();
    } catch {
        // ignore parse failure
    }
    throw new SearchbaseCanvasPersistenceError(
        friendlyMessage(response.status, body, 'delete canvas'),
        response.status
    );
};
