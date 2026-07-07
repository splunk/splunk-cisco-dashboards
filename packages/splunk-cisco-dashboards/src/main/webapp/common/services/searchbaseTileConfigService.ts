/**
 * searchbaseTileConfigService — admin-only write path for the three
 * Overview tile-settings categories that must be identical for every
 * viewer: Thresholds, Data Mapping (value field / label / which search
 * feeds the tile), and Drilldown.
 *
 * Why this exists: `usePersistedMetricOverrides` used to store these
 * fields in browser localStorage, which meant two people looking at
 * the same tile could see different thresholds or different drilldown
 * targets — a correctness problem, not a preference. This service
 * writes the same fields into `local/searchbase.conf` instead, via
 * Splunk's built-in conf REST endpoint. Splunk layers `local/` over
 * `default/searchbase.conf` automatically on the *read* side, so once
 * a write here succeeds, the existing `getSearchbaseCatalogue()` /
 * `buildOverviewMetricConfig()` read path picks it up with no extra
 * merge logic — the app can't tell "admin-customised default" apart
 * from "factory default", which is exactly the point.
 *
 * Write access is enforced server-side via `metadata/default.meta`
 * (`perms.write = admin`, which — combined with Splunk's rule that the
 * `admin_all_objects` capability bypasses object ACLs entirely — means
 * only users holding `admin_all_objects` can actually persist a
 * change). The UI-side gate in `useCanManageFactoryTileConfig` is a
 * courtesy (avoids a round-trip 403 for people who obviously can't
 * write), not the security boundary.
 *
 * Conf layering caveat: Splunk's ACL/layering model replaces a KEY's
 * entire value, not fields inside it. `viz_options` is one JSON blob
 * per stanza, so every write here does read-effective-JSON -> patch
 * the relevant sub-fields -> write the FULL JSON back. Writing a
 * partial JSON blob would silently drop whatever fields only existed
 * in `default/searchbase.conf` (tileId, section, etc.).
 */

import { createFetchInit } from '@splunk/splunk-utils/fetch';

import { getSearchAppContext } from './splunkSearchService';
import { clearSearchbaseCache } from './searchbaseCatalogue';

const APP_NAME = 'splunk-cisco-dashboards';
const CONF_BASENAME = 'searchbase';

export interface TileThresholdsPatch {
    warning?: number;
    critical?: number;
    direction?: 'higher_is_better' | 'lower_is_better';
}

export interface TileDataMappingPatch {
    label?: string;
    valueField?: string;
}

export class SearchbaseTileConfigError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
        super(message);
        this.name = 'SearchbaseTileConfigError';
        this.status = status;
    }
}

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

const buildStanzaUrl = (owner: string, appName: string, stanza: string): string =>
    `/en-US/splunkd/__raw/servicesNS/${owner}/${appName}/configs/conf-${CONF_BASENAME}/${encodeURIComponent(stanza)}`;

const extractErrorMessage = async (response: Response, fallback: string): Promise<string> => {
    try {
        const body = (await response.json()) as { messages?: Array<{ text?: string }> };
        const detail = Array.isArray(body.messages)
            ? body.messages
                  .map((m) => (typeof m?.text === 'string' ? m.text : ''))
                  .filter(Boolean)
                  .join('; ')
            : '';
        return detail ? `${fallback}: ${detail}` : `${fallback}: HTTP ${response.status}`;
    } catch {
        return `${fallback}: HTTP ${response.status}`;
    }
};

interface ConfStanzaEntry {
    content?: Record<string, unknown>;
}

/**
 * Fetches the *effective* (already default+local merged, by Splunk)
 * content for a single searchbase stanza. Read-side of every
 * read-modify-write in this file.
 */
const loadEffectiveStanza = async (
    stanza: string
): Promise<{ vizOptions: Record<string, unknown>; raw: Record<string, unknown> }> => {
    if (!isInSplunkRuntime()) return { vizOptions: {}, raw: {} };
    const appName = getSearchAppContext() || APP_NAME;
    const headers: Record<string, string> = { Accept: 'application/json' };
    const csrf = getCsrfToken();
    if (csrf) headers['X-Splunk-Form-Key'] = csrf;

    const response = await fetch(`${buildStanzaUrl('-', appName, stanza)}?output_mode=json`, {
        method: 'GET',
        credentials: 'include',
        headers,
    });
    if (!response.ok) {
        throw new SearchbaseTileConfigError(
            await extractErrorMessage(response, `Couldn't load searchbase.conf stanza "${stanza}"`),
            response.status
        );
    }
    const json = (await response.json()) as { entry?: ConfStanzaEntry[] };
    const content = json.entry?.[0]?.content ?? {};
    const rawVizOptions = content.viz_options;
    let vizOptions: Record<string, unknown> = {};
    if (typeof rawVizOptions === 'string' && rawVizOptions.trim()) {
        try {
            const parsed = JSON.parse(rawVizOptions) as unknown;
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                vizOptions = parsed as Record<string, unknown>;
            }
        } catch {
            // Malformed JSON on the existing stanza — treat as empty
            // rather than throwing, so a save can still repair it.
            vizOptions = {};
        }
    }
    return { vizOptions, raw: content };
};

const writeStanzaKeys = async (
    stanza: string,
    fields: Record<string, string>
): Promise<void> => {
    if (!isInSplunkRuntime()) return;
    const appName = getSearchAppContext() || APP_NAME;
    const body = new URLSearchParams({ ...fields, output_mode: 'json' });
    const postInit = createFetchInit({
        method: 'POST',
        body: body.toString(),
        headers: { Accept: 'application/json' },
    });
    const response = await fetch(buildStanzaUrl('nobody', appName, stanza), postInit);
    if (response.ok) return;
    throw new SearchbaseTileConfigError(
        await extractErrorMessage(response, `Couldn't save searchbase.conf stanza "${stanza}"`),
        response.status
    );
};

/**
 * Finds the single `overview` entry within a stanza's `viz_options`
 * that matches `tileId`, normalising both the array and bare-object
 * shapes `buildOverviewMetricConfig` already tolerates on read.
 * Returns an entry array so callers can write back whichever shape
 * the stanza already used (falls back to array-of-one for a stanza
 * that had no `overview` key yet).
 */
const patchOverviewEntry = (
    vizOptions: Record<string, unknown>,
    tileId: string,
    patch: (entry: Record<string, unknown>) => Record<string, unknown>
): Record<string, unknown> => {
    const next: Record<string, unknown> = { ...vizOptions };
    const raw = next.overview;

    if (Array.isArray(raw)) {
        let matched = false;
        const nextArray = raw.map((entry) => {
            if (
                entry &&
                typeof entry === 'object' &&
                !Array.isArray(entry) &&
                (entry as Record<string, unknown>).tileId === tileId
            ) {
                matched = true;
                return patch({ ...(entry as Record<string, unknown>) });
            }
            return entry;
        });
        next.overview = matched ? nextArray : [...raw, patch({ tileId })];
        return next;
    }

    if (raw && typeof raw === 'object') {
        const entry = raw as Record<string, unknown>;
        next.overview = entry.tileId === tileId || entry.tileId === undefined
            ? patch({ ...entry, tileId })
            : entry; // Different tile than expected for a single-object stanza — leave untouched.
        return next;
    }

    next.overview = [patch({ tileId })];
    return next;
};

/** Removes any `overview` entry matching `tileId` from a stanza's viz_options. */
const removeOverviewEntry = (
    vizOptions: Record<string, unknown>,
    tileId: string
): Record<string, unknown> => {
    const next: Record<string, unknown> = { ...vizOptions };
    const raw = next.overview;
    if (Array.isArray(raw)) {
        next.overview = raw.filter(
            (entry) =>
                !(
                    entry &&
                    typeof entry === 'object' &&
                    !Array.isArray(entry) &&
                    (entry as Record<string, unknown>).tileId === tileId
                )
        );
    } else if (raw && typeof raw === 'object' && (raw as Record<string, unknown>).tileId === tileId) {
        delete next.overview;
    }
    return next;
};

/** Admin save: warning / critical / direction for one tile, in its own stanza. */
export const saveTileThresholds = async (
    stanzaId: string,
    tileId: string,
    thresholds: TileThresholdsPatch
): Promise<void> => {
    const { vizOptions } = await loadEffectiveStanza(stanzaId);
    const patched = patchOverviewEntry(vizOptions, tileId, (entry) => ({
        ...entry,
        thresholds: {
            ...(entry.thresholds && typeof entry.thresholds === 'object' ? entry.thresholds : {}),
            ...(thresholds.warning !== undefined ? { warning: thresholds.warning } : {}),
            ...(thresholds.critical !== undefined ? { critical: thresholds.critical } : {}),
            ...(thresholds.direction ? { direction: thresholds.direction } : {}),
        },
    }));
    await writeStanzaKeys(stanzaId, { viz_options: JSON.stringify(patched) });
    clearSearchbaseCache();
};

/** Admin save: label / valueField for one tile, in its own stanza (no search rebind). */
export const saveTileDataMapping = async (
    stanzaId: string,
    tileId: string,
    mapping: TileDataMappingPatch
): Promise<void> => {
    const { vizOptions } = await loadEffectiveStanza(stanzaId);
    const patched = patchOverviewEntry(vizOptions, tileId, (entry) => ({
        ...entry,
        ...(mapping.label !== undefined ? { label: mapping.label } : {}),
        ...(mapping.valueField !== undefined ? { valueField: mapping.valueField } : {}),
    }));
    await writeStanzaKeys(stanzaId, { viz_options: JSON.stringify(patched) });
    clearSearchbaseCache();
};

/**
 * Admin save: rebind a tile to a different searchbase stanza entirely
 * (full Data Mapping search swap). This moves the `overview` entry
 * for `tileId` from `fromStanzaId` to `toStanzaId`.
 *
 * Ordering matters for failure safety: we add the entry to the new
 * stanza FIRST, then remove it from the old one. If the process dies
 * between the two writes, the tile is briefly defined in both stanzas
 * (a harmless, self-correcting duplicate — the read path takes the
 * first match) rather than in neither (which would make the tile
 * disappear from the dashboard).
 */
export const saveTileSearchBinding = async (
    fromStanzaId: string,
    toStanzaId: string,
    tileId: string,
    section: string,
    carryForward: { label?: string; valueField?: string; thresholds?: TileThresholdsPatch }
): Promise<void> => {
    if (fromStanzaId === toStanzaId) return;

    const { vizOptions: toVizOptions } = await loadEffectiveStanza(toStanzaId);
    const patchedTo = patchOverviewEntry(toVizOptions, tileId, (entry) => ({
        ...entry,
        tileId,
        section,
        ...(carryForward.label !== undefined ? { label: carryForward.label } : {}),
        ...(carryForward.valueField !== undefined ? { valueField: carryForward.valueField } : {}),
        ...(carryForward.thresholds
            ? {
                  thresholds: {
                      ...(entry.thresholds && typeof entry.thresholds === 'object' ? entry.thresholds : {}),
                      ...carryForward.thresholds,
                  },
              }
            : {}),
    }));
    await writeStanzaKeys(toStanzaId, { viz_options: JSON.stringify(patchedTo) });
    clearSearchbaseCache();

    const { vizOptions: fromVizOptions } = await loadEffectiveStanza(fromStanzaId);
    const patchedFrom = removeOverviewEntry(fromVizOptions, tileId);
    await writeStanzaKeys(fromStanzaId, { viz_options: JSON.stringify(patchedFrom) });
    clearSearchbaseCache();
};

/** Admin save: drilldown_search_name is already a flat top-level key — no JSON merge needed. */
export const saveTileDrilldown = async (
    stanzaId: string,
    drilldownSearchName: string | null
): Promise<void> => {
    await writeStanzaKeys(stanzaId, {
        drilldown_search_name: drilldownSearchName ?? '',
    });
    clearSearchbaseCache();
};

export interface FactoryTileConfigPatch {
    tileId: string;
    section: string;
    /** Current stanza id the tile is defined on (before this save). */
    fromStanzaId: string;
    thresholds?: TileThresholdsPatch;
    dataMapping?: TileDataMappingPatch;
    /** Present only when the admin picked a different search entirely. */
    searchRebind?: { toStanzaId: string };
    /** `undefined` = don't touch; `null` = clear; string = set. */
    drilldownSearchName?: string | null;
}

/**
 * Single entry point the UI calls on Apply. Sequences the writes so a
 * partial failure fails safely:
 *   1. Search rebind first (add-to-new before remove-from-old, see
 *      `saveTileSearchBinding`) — if this fails, nothing else has
 *      changed yet.
 *   2. Thresholds / data mapping on whichever stanza now owns the
 *      tile (the new one if rebinding, otherwise the original).
 *   3. Drilldown last, on the same stanza.
 * Throws on the first failure; callers should treat a thrown error as
 * "some of this may have saved, re-open the picker to see the actual
 * current state" rather than assuming an all-or-nothing rollback.
 */
export const saveFactoryTileConfig = async (patch: FactoryTileConfigPatch): Promise<void> => {
    let ownerStanzaId = patch.fromStanzaId;

    if (patch.searchRebind && patch.searchRebind.toStanzaId !== patch.fromStanzaId) {
        await saveTileSearchBinding(
            patch.fromStanzaId,
            patch.searchRebind.toStanzaId,
            patch.tileId,
            patch.section,
            { label: patch.dataMapping?.label, valueField: patch.dataMapping?.valueField, thresholds: patch.thresholds }
        );
        ownerStanzaId = patch.searchRebind.toStanzaId;
    } else {
        if (patch.thresholds && Object.keys(patch.thresholds).length > 0) {
            await saveTileThresholds(ownerStanzaId, patch.tileId, patch.thresholds);
        }
        if (patch.dataMapping && Object.keys(patch.dataMapping).length > 0) {
            await saveTileDataMapping(ownerStanzaId, patch.tileId, patch.dataMapping);
        }
    }

    if (patch.drilldownSearchName !== undefined) {
        await saveTileDrilldown(ownerStanzaId, patch.drilldownSearchName);
    }
};
