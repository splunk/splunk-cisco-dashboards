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
import {
    EXECUTIVE_WORKSPACE_SOURCE_ID,
    isWorkspaceSourceId,
    type WorkspaceSourceId,
} from '@/common/config/insightsWorkspaces';

const APP_NAME = 'splunk-cisco-dashboards';
const CONF_BASENAME = 'searchbase';

const DEFAULT_EXECUTIVE_WORKSPACE_STANZA_IDS = [
    'building_resilience_environmental_health_index',
    'building_resilience_water_leak_detection',
    'building_resilience_wireless_devices_to_review_count',
    'executive_dashboard_active_clients',
    'executive_dashboard_issue_summary_kpis',
    'executive_dashboard_building_domain_score',
    'executive_dashboard_building_occupancy',
    'executive_dashboard_it_domain_score',
    'executive_dashboard_security_domain_score',
    'it_critical_systems_compliance_rate',
    'it_critical_systems_configuration_changes',
    'it_critical_systems_device_health_score',
    'it_critical_systems_device_inventory_by_type',
    'it_critical_systems_network_health_score',
    'it_critical_systems_syslog_severity_distribution',
    'security_resilience_dns_blocked_queries',
    'security_resilience_email_threat_count',
    'security_resilience_rogue_device_detection',
    'security_resilience_web_threat_count',
    'executive_dashboard_active_devices',
    'executive_dashboard_collab_devices',
    'executive_dashboard_wifi_clients',
    'building_resilience_rooms_occupied_trend',
    'executive_dashboard_ds_ux_score',
    'overview_active_critical_alerts',
    'overview_xdr_critical_incidents',
    'overview_ap_health',
    'executive_dashboard_critical_website_availability',
    'executive_dashboard_firewall_blocked_with_baseline',
    'executive_dashboard_threat_sources_with_baseline',
    'executive_dashboard_failed_logon_with_baseline',
    'security_ai_defense_block_rate_kpi',
    'identity_duo_tenant_kpis',
] as const;

const STANZA_ID_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.:-]{0,255}$/;
const DRILLDOWN_TARGET_LIMIT = 24;

const entryWorkspace = (entry: Record<string, unknown>): WorkspaceSourceId => {
    const raw = entry.workspace ?? entry.profile;
    return isWorkspaceSourceId(raw) ? raw : EXECUTIVE_WORKSPACE_SOURCE_ID;
};

const entryMatchesTile = (
    entry: Record<string, unknown>,
    tileId: string,
    workspaceId: WorkspaceSourceId
): boolean =>
    entry.tileId === tileId && entryWorkspace(entry) === workspaceId;

const withWorkspace = (
    entry: Record<string, unknown>,
    workspaceId: WorkspaceSourceId
): Record<string, unknown> => {
    if (workspaceId === EXECUTIVE_WORKSPACE_SOURCE_ID) {
        const rest = { ...entry };
        delete rest.workspace;
        delete rest.profile;
        return rest;
    }
    const rest: Record<string, unknown> = { ...entry, workspace: workspaceId };
    delete rest.profile;
    return rest;
};

export interface TileThresholdsPatch {
    enabled?: boolean;
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

const deleteStanzaLocalOverride = async (stanza: string): Promise<void> => {
    if (!isInSplunkRuntime()) return;
    const appName = getSearchAppContext() || APP_NAME;
    const deleteInit = createFetchInit({
        method: 'DELETE',
        headers: { Accept: 'application/json' },
    });
    const response = await fetch(
        `${buildStanzaUrl('nobody', appName, stanza)}?output_mode=json`,
        deleteInit
    );
    if (response.ok || response.status === 404) return;
    throw new SearchbaseTileConfigError(
        await extractErrorMessage(
            response,
            `Couldn't reset searchbase.conf stanza "${stanza}"`
        ),
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
    workspaceId: WorkspaceSourceId,
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
                entryMatchesTile(entry as Record<string, unknown>, tileId, workspaceId)
            ) {
                matched = true;
                return withWorkspace(
                    patch({ ...(entry as Record<string, unknown>) }),
                    workspaceId
                );
            }
            return entry;
        });
        next.overview = matched
            ? nextArray
            : [...raw, withWorkspace(patch({ tileId }), workspaceId)];
        return next;
    }

    if (raw && typeof raw === 'object') {
        const entry = raw as Record<string, unknown>;
        next.overview =
            entryMatchesTile(entry, tileId, workspaceId) || entry.tileId === undefined
                ? withWorkspace(patch({ ...entry, tileId }), workspaceId)
                : [entry, withWorkspace(patch({ tileId }), workspaceId)];
        return next;
    }

    next.overview = [withWorkspace(patch({ tileId }), workspaceId)];
    return next;
};

/** Removes any `overview` entry matching `tileId` from a stanza's viz_options. */
const removeOverviewEntry = (
    vizOptions: Record<string, unknown>,
    tileId: string,
    workspaceId: WorkspaceSourceId
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
                    entryMatchesTile(
                        entry as Record<string, unknown>,
                        tileId,
                        workspaceId
                    )
                )
        );
    } else if (
        raw &&
        typeof raw === 'object' &&
        entryMatchesTile(raw as Record<string, unknown>, tileId, workspaceId)
    ) {
        delete next.overview;
    }
    return next;
};

/** Admin save: warning / critical / direction for one tile, in its own stanza. */
export const saveTileThresholds = async (
    stanzaId: string,
    tileId: string,
    thresholds: TileThresholdsPatch,
    workspaceId: WorkspaceSourceId = EXECUTIVE_WORKSPACE_SOURCE_ID
): Promise<void> => {
    const { vizOptions } = await loadEffectiveStanza(stanzaId);
    const patched = patchOverviewEntry(vizOptions, tileId, workspaceId, (entry) => ({
        ...entry,
        thresholds: {
            ...(entry.thresholds && typeof entry.thresholds === 'object' ? entry.thresholds : {}),
            ...(thresholds.enabled !== undefined ? { enabled: thresholds.enabled } : {}),
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
    mapping: TileDataMappingPatch,
    workspaceId: WorkspaceSourceId = EXECUTIVE_WORKSPACE_SOURCE_ID
): Promise<void> => {
    const { vizOptions } = await loadEffectiveStanza(stanzaId);
    const patched = patchOverviewEntry(vizOptions, tileId, workspaceId, (entry) => ({
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
    carryForward: { label?: string; valueField?: string; thresholds?: TileThresholdsPatch },
    workspaceId: WorkspaceSourceId = EXECUTIVE_WORKSPACE_SOURCE_ID
): Promise<void> => {
    if (fromStanzaId === toStanzaId) return;

    const { vizOptions: toVizOptions } = await loadEffectiveStanza(toStanzaId);
    const patchedTo = patchOverviewEntry(toVizOptions, tileId, workspaceId, (entry) => ({
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
    const patchedFrom = removeOverviewEntry(fromVizOptions, tileId, workspaceId);
    await writeStanzaKeys(fromStanzaId, { viz_options: JSON.stringify(patchedFrom) });
    clearSearchbaseCache();
};

/**
 * Admin save: the ordered stanza-id list is canonical. Clearing both
 * compatibility keys is required because Splunk merges default/local config
 * by key; otherwise an older local override or shipped singular default could
 * continue to win after this write.
 */
export const saveTileDrilldowns = async (
    stanzaId: string,
    drilldownStanzaIds: readonly string[] | null
): Promise<void> => {
    const normalizedIds: string[] = [];
    const seen = new Set<string>();
    for (const rawId of drilldownStanzaIds ?? []) {
        const targetId = rawId.trim();
        if (!STANZA_ID_PATTERN.test(targetId)) {
            throw new SearchbaseTileConfigError(`Invalid drilldown stanza id: ${rawId}`);
        }
        if (seen.has(targetId)) continue;
        seen.add(targetId);
        normalizedIds.push(targetId);
        if (normalizedIds.length >= DRILLDOWN_TARGET_LIMIT) break;
    }
    await writeStanzaKeys(stanzaId, {
        drilldown_stanza_ids: normalizedIds.join(','),
        drilldown_stanza_id: '',
        drilldown_search_name: '',
    });
    clearSearchbaseCache();
};

export interface FactoryTileConfigPatch {
    tileId: string;
    workspaceId?: WorkspaceSourceId;
    section: string;
    /** Current stanza id the tile is defined on (before this save). */
    fromStanzaId: string;
    thresholds?: TileThresholdsPatch;
    dataMapping?: TileDataMappingPatch;
    /** Present only when the admin picked a different search entirely. */
    searchRebind?: { toStanzaId: string };
    /** `undefined` = don't touch; `null` = clear; array = ordered target stanza ids. */
    drilldownSearchNames?: string[] | null;
}

const normalizedDrilldownFields = (
    drilldownStanzaIds: readonly string[] | null,
): Record<string, string> => {
    const normalizedIds: string[] = [];
    const seen = new Set<string>();
    for (const rawId of drilldownStanzaIds ?? []) {
        const targetId = rawId.trim();
        if (!STANZA_ID_PATTERN.test(targetId)) {
            throw new SearchbaseTileConfigError(
                `Invalid drilldown stanza id: ${rawId}`,
            );
        }
        if (seen.has(targetId)) continue;
        seen.add(targetId);
        normalizedIds.push(targetId);
        if (normalizedIds.length >= DRILLDOWN_TARGET_LIMIT) break;
    }
    return {
        drilldown_stanza_ids: normalizedIds.join(','),
        drilldown_stanza_id: '',
        drilldown_search_name: '',
    };
};

const existingDrilldownFields = (
    raw: Record<string, unknown>,
): Record<string, string> => ({
    drilldown_stanza_ids:
        typeof raw.drilldown_stanza_ids === 'string'
            ? raw.drilldown_stanza_ids
            : '',
    drilldown_stanza_id:
        typeof raw.drilldown_stanza_id === 'string'
            ? raw.drilldown_stanza_id
            : '',
    drilldown_search_name:
        typeof raw.drilldown_search_name === 'string'
            ? raw.drilldown_search_name
            : '',
});

const patchFactoryEntry = (
    entry: Record<string, unknown>,
    patch: FactoryTileConfigPatch,
): Record<string, unknown> => ({
        ...entry,
        ...(patch.dataMapping?.label !== undefined
            ? { label: patch.dataMapping.label }
            : {}),
        ...(patch.dataMapping?.valueField !== undefined
            ? { valueField: patch.dataMapping.valueField }
            : {}),
        ...(patch.thresholds && Object.keys(patch.thresholds).length > 0
            ? {
                  thresholds: {
                      ...(entry.thresholds &&
                      typeof entry.thresholds === 'object'
                          ? entry.thresholds
                          : {}),
                      ...patch.thresholds,
                  },
              }
            : {}),
    });

const patchFactoryOverviewEntry = (
    vizOptions: Record<string, unknown>,
    patch: FactoryTileConfigPatch,
    workspaceId: WorkspaceSourceId,
): Record<string, unknown> =>
    patchOverviewEntry(vizOptions, patch.tileId, workspaceId, (entry) =>
        patchFactoryEntry(entry, patch),
    );

/**
 * Single entry point the UI calls on Apply. All changes for one owning
 * stanza are submitted in one REST write. A search rebind necessarily spans
 * two stanzas; it writes the target first, removes the source second, and
 * restores the target if the source update fails so a partial operation does
 * not leave duplicate tile definitions behind.
 */
export const saveFactoryTileConfig = async (patch: FactoryTileConfigPatch): Promise<void> => {
    const workspaceId = patch.workspaceId ?? EXECUTIVE_WORKSPACE_SOURCE_ID;
    const drilldownFields =
        patch.drilldownSearchNames !== undefined
            ? normalizedDrilldownFields(patch.drilldownSearchNames)
            : {};
    const rebindTarget = patch.searchRebind?.toStanzaId;

    if (!rebindTarget || rebindTarget === patch.fromStanzaId) {
        const { vizOptions } = await loadEffectiveStanza(patch.fromStanzaId);
        const hasOverviewChanges =
            Boolean(patch.thresholds && Object.keys(patch.thresholds).length > 0) ||
            Boolean(patch.dataMapping && Object.keys(patch.dataMapping).length > 0);
        const fields: Record<string, string> = { ...drilldownFields };
        if (hasOverviewChanges) {
            fields.viz_options = JSON.stringify(
                patchFactoryOverviewEntry(vizOptions, patch, workspaceId),
            );
        }
        if (Object.keys(fields).length > 0) {
            await writeStanzaKeys(patch.fromStanzaId, fields);
            clearSearchbaseCache();
        }
        return;
    }

    const fromState = await loadEffectiveStanza(patch.fromStanzaId);
    const toState = await loadEffectiveStanza(rebindTarget);
    const patchedTarget = patchOverviewEntry(
        toState.vizOptions,
        patch.tileId,
        workspaceId,
        (entry) =>
            patchFactoryEntry(
                {
                    ...entry,
                    tileId: patch.tileId,
                    section: patch.section,
                },
                patch,
            ),
    );
    await writeStanzaKeys(rebindTarget, {
        viz_options: JSON.stringify(patchedTarget),
        ...drilldownFields,
    });

    try {
        const patchedSource = removeOverviewEntry(
            fromState.vizOptions,
            patch.tileId,
            workspaceId,
        );
        await writeStanzaKeys(patch.fromStanzaId, {
            viz_options: JSON.stringify(patchedSource),
        });
    } catch (sourceError) {
        try {
            await writeStanzaKeys(rebindTarget, {
                viz_options: JSON.stringify(toState.vizOptions),
                ...(patch.drilldownSearchNames !== undefined
                    ? existingDrilldownFields(toState.raw)
                    : {}),
            });
        } catch (rollbackError) {
            throw new SearchbaseTileConfigError(
                `Search replacement could not be completed or rolled back. Reload Searchbase and review both "${patch.fromStanzaId}" and "${rebindTarget}" before retrying. ${
                    rollbackError instanceof Error ? rollbackError.message : ''
                }`,
            );
        }
        throw sourceError;
    }
    clearSearchbaseCache();
};

export const resetInsightsWorkspaceTileConfig = async (
    currentOwnerStanzaIds: readonly (string | undefined | null)[],
    workspaceId: WorkspaceSourceId = EXECUTIVE_WORKSPACE_SOURCE_ID
): Promise<void> => {
    if (!isInSplunkRuntime()) return;

    const stanzaIds = new Set<string>(
        workspaceId === EXECUTIVE_WORKSPACE_SOURCE_ID
            ? DEFAULT_EXECUTIVE_WORKSPACE_STANZA_IDS
            : []
    );
    currentOwnerStanzaIds.forEach((raw) => {
        const stanza = typeof raw === 'string' ? raw.trim() : '';
        if (!stanza || !STANZA_ID_PATTERN.test(stanza)) return;
        stanzaIds.add(stanza);
    });

    await Promise.all(
        Array.from(stanzaIds, (stanza) => deleteStanzaLocalOverride(stanza))
    );
    clearSearchbaseCache();
};
