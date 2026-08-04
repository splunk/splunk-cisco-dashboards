import { createFetchInit } from '@splunk/splunk-utils/fetch';

import {
    PACKAGED_WORKSPACE_FALLBACKS,
    createInsightsWorkspace,
    getWorkspaceSource,
    isWorkspaceId,
    isWorkspaceSectionId,
    isWorkspaceSourceId,
    type InsightsWorkspace,
    type SectionId,
    type WorkspaceDefinitionInput,
    type WorkspaceId,
} from '@/common/config/insightsWorkspaces';

const APP_NAME = 'splunk-cisco-dashboards';
export const INSIGHTS_WORKSPACES_CONF_BASENAME = 'insights_workspaces';
const TILE_ID_PATTERN = /^[a-z0-9_]{1,128}$/;
const SEARCHBASE_ID_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.:-]{0,255}$/;

const WORKSPACE_STANZA_PREFIX = 'workspace.';
const LAYOUT_STANZA_PREFIX = 'layout.';

export interface WorkspaceLayoutSection {
    tiles: string[];
    visibleCount?: number;
    /** Searchbase stanza IDs intentionally added to this shared workspace section. */
    searchbaseAdditions?: string[];
}

export type WorkspaceLayoutConfig = Partial<
    Record<SectionId, WorkspaceLayoutSection>
>;

export interface InsightsWorkspaceBundle {
    workspaces: InsightsWorkspace[];
    layouts: Record<WorkspaceId, WorkspaceLayoutConfig>;
}

interface ConfRestEntry {
    name?: string;
    content?: Record<string, unknown>;
}

const isInSplunkRuntime = (): boolean => {
    if (typeof window === 'undefined') return false;
    const runtime = window as unknown as { __SPLUNK_RUNTIME__?: boolean; $C?: unknown };
    if (runtime.__SPLUNK_RUNTIME__ === false) return false;
    if (runtime.__SPLUNK_RUNTIME__ === true) return true;
    return Boolean(runtime.$C) || Boolean(document.cookie?.includes('splunkweb_csrf_token'));
};

const buildBaseUrl = (forWrite: boolean): string => {
    const owner = forWrite ? 'nobody' : '-';
    return `/en-US/splunkd/__raw/servicesNS/${owner}/${APP_NAME}/configs/conf-${INSIGHTS_WORKSPACES_CONF_BASENAME}`;
};

const getCurrentUser = (): string => {
    if (typeof window === 'undefined') return 'unknown';
    const $C = (window as unknown as { $C?: Record<string, unknown> }).$C;
    const username = $C?.USERNAME;
    return typeof username === 'string' && username.trim() ? username.trim() : 'unknown';
};

const optionalString = (raw: unknown): string | undefined =>
    typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;

const optionalInt = (raw: unknown): number | undefined => {
    if (raw === undefined || raw === null || raw === '') return undefined;
    const parsed = Number.parseInt(String(raw), 10);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const readBoolean = (raw: unknown, fallback: boolean): boolean => {
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'number') return raw !== 0;
    if (typeof raw !== 'string') return fallback;
    const normalized = raw.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
};

const readThemePreference = (raw: unknown): 'light' | 'dark' | 'system' =>
    raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';

const readMapPosition = (raw: unknown): 'right' | 'below' | 'above' =>
    raw === 'below' || raw === 'above' ? raw : 'right';

const readRegionalView = (raw: unknown): 'map' | 'table' =>
    raw === 'table' ? 'table' : 'map';

const splitCsv = (raw: unknown): string[] => {
    const value = optionalString(raw);
    if (!value) return [];
    const seen = new Set<string>();
    return value
        .split(',')
        .map((part) => part.trim())
        .filter((part) => {
            if (!part || seen.has(part)) return false;
            seen.add(part);
            return true;
        });
};

const splitTiles = (raw: unknown): string[] =>
    splitCsv(raw).filter((tileId) => TILE_ID_PATTERN.test(tileId));

const splitSearchbaseAdditions = (raw: unknown): string[] =>
    splitCsv(raw).filter((searchbaseId) => SEARCHBASE_ID_PATTERN.test(searchbaseId));

const extractErrorMessage = async (
    response: Response,
    fallback: string,
): Promise<string> => {
    try {
        const body = (await response.json()) as {
            messages?: Array<{ text?: string }>;
        };
        const detail = Array.isArray(body.messages)
            ? body.messages
                  .map((message) =>
                      typeof message?.text === 'string' ? message.text : '',
                  )
                  .filter(Boolean)
                  .join('; ')
            : '';
        return detail ? `${fallback}: ${detail}` : `${fallback}: HTTP ${response.status}`;
    } catch {
        return `${fallback}: HTTP ${response.status}`;
    }
};

const parseWorkspaceEntry = (entry: ConfRestEntry): InsightsWorkspace | null => {
    const stanzaName = entry.name;
    if (typeof stanzaName !== 'string' || !stanzaName.startsWith(WORKSPACE_STANZA_PREFIX)) {
        return null;
    }
    const id = stanzaName.slice(WORKSPACE_STANZA_PREFIX.length);
    if (!isWorkspaceId(id)) return null;

    const content = entry.content ?? {};
    const sourceWorkspace = content.source_workspace;
    if (!isWorkspaceSourceId(sourceWorkspace)) return null;
    const source = getWorkspaceSource(sourceWorkspace);
    const sourceSectionIds = new Set(source.sections.map((section) => section.id));
    const sectionIds = splitCsv(content.sections).filter(
        (sectionId): sectionId is SectionId =>
            isWorkspaceSectionId(sectionId) && sourceSectionIds.has(sectionId),
    );
    const defaultVisibleSections = splitCsv(content.default_visible_sections).filter(
        (sectionId): sectionId is SectionId =>
            isWorkspaceSectionId(sectionId) &&
            (sectionIds.length === 0 || sectionIds.includes(sectionId)),
    );

    return createInsightsWorkspace({
        id,
        label: optionalString(content.label) ?? id,
        sourceWorkspace,
        sectionIds: sectionIds.length > 0 ? sectionIds : undefined,
        defaultVisibleSections:
            defaultVisibleSections.length > 0 ? defaultVisibleSections : undefined,
        maxVisibleSections: optionalInt(content.max_visible_sections),
        minTileCount: optionalInt(content.min_tile_count),
        maxTileCount: optionalInt(content.max_tile_count),
        fallbackTileCount: optionalInt(content.default_tile_count),
        headerTitle: optionalString(content.header_title),
        headerSubtitle: optionalString(content.header_subtitle),
        defaultLogoSrc: optionalString(content.default_logo_src),
        hideDefaultLogo: readBoolean(content.hide_default_logo, false),
        legacyViewNames: splitCsv(content.legacy_view_names),
        isBuiltIn: readBoolean(content.is_builtin, false),
        enabled: readBoolean(content.enabled, true),
        sortOrder: optionalInt(content.sort_order),
        themePreference: readThemePreference(content.theme_preference),
        mapVisible: readBoolean(content.map_visible, true),
        mapPosition: readMapPosition(content.map_position),
        regionalView: readRegionalView(content.regional_view),
    });
};

export const parseInsightsWorkspaceEntries = (
    entries: readonly ConfRestEntry[],
): InsightsWorkspaceBundle => {
    const workspaces = entries
        .map(parseWorkspaceEntry)
        .filter((workspace): workspace is InsightsWorkspace => Boolean(workspace))
        .filter((workspace) => workspace.enabled)
        .sort(
            (left, right) =>
                left.sortOrder - right.sortOrder || left.label.localeCompare(right.label),
        );
    const effectiveWorkspaces =
        workspaces.length > 0 ? workspaces : [...PACKAGED_WORKSPACE_FALLBACKS];
    const workspaceById = new Map(
        effectiveWorkspaces.map((workspace) => [workspace.id, workspace]),
    );
    const layouts: Record<WorkspaceId, WorkspaceLayoutConfig> = {};

    for (const entry of entries) {
        const stanzaName = entry.name;
        if (typeof stanzaName !== 'string' || !stanzaName.startsWith(LAYOUT_STANZA_PREFIX)) {
            continue;
        }
        const rest = stanzaName.slice(LAYOUT_STANZA_PREFIX.length);
        const separator = rest.indexOf('.');
        if (separator <= 0) continue;
        const workspaceId = rest.slice(0, separator);
        const sectionId = rest.slice(separator + 1);
        const workspace = workspaceById.get(workspaceId);
        if (!workspace || !isWorkspaceSectionId(sectionId)) continue;
        if (!workspace.sections.some((section) => section.id === sectionId)) continue;
        const content = entry.content ?? {};
        const visibleCount = optionalInt(content.visible_count);
        const config = layouts[workspaceId] ?? {};
        config[sectionId] = {
            tiles: splitTiles(content.tiles),
            searchbaseAdditions: splitSearchbaseAdditions(content.searchbase_additions),
            visibleCount:
                visibleCount !== undefined
                    ? Math.min(Math.max(visibleCount, 1), workspace.maxTileCount)
                    : undefined,
        };
        layouts[workspaceId] = config;
    }

    return { workspaces: effectiveWorkspaces, layouts };
};

export const loadInsightsWorkspaces = async (): Promise<InsightsWorkspaceBundle> => {
    if (!isInSplunkRuntime()) {
        return { workspaces: [...PACKAGED_WORKSPACE_FALLBACKS], layouts: {} };
    }

    const response = await fetch(`${buildBaseUrl(false)}?output_mode=json&count=0`, {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
        throw new Error(
            await extractErrorMessage(response, "Couldn't load Insights workspaces"),
        );
    }

    const json = (await response.json()) as { entry?: ConfRestEntry[] };
    return parseInsightsWorkspaceEntries(Array.isArray(json.entry) ? json.entry : []);
};

const workspaceStanzaName = (workspaceId: WorkspaceId): string =>
    `${WORKSPACE_STANZA_PREFIX}${workspaceId}`;

const layoutStanzaName = (workspaceId: WorkspaceId, sectionId: SectionId): string =>
    `${LAYOUT_STANZA_PREFIX}${workspaceId}.${sectionId}`;

const upsertStanza = async (
    stanzaName: string,
    fields: Record<string, string>,
): Promise<void> => {
    if (!isInSplunkRuntime()) return;
    const body = new URLSearchParams({
        ...fields,
        updated_at: new Date().toISOString(),
        updated_by: getCurrentUser(),
        output_mode: 'json',
    });
    const updateUrl = `${buildBaseUrl(true)}/${encodeURIComponent(stanzaName)}`;
    const response = await fetch(
        updateUrl,
        createFetchInit({
            method: 'POST',
            body: body.toString(),
            headers: { Accept: 'application/json' },
        }),
    );
    if (response.ok) return;

    if (response.status === 404) {
        const createBody = new URLSearchParams(body);
        createBody.set('name', stanzaName);
        const createResponse = await fetch(
            buildBaseUrl(true),
            createFetchInit({
                method: 'POST',
                body: createBody.toString(),
                headers: { Accept: 'application/json' },
            }),
        );
        if (createResponse.ok) return;
        throw new Error(
            await extractErrorMessage(
                createResponse,
                `Couldn't create Insights workspace stanza "${stanzaName}"`,
            ),
        );
    }

    throw new Error(
        await extractErrorMessage(
            response,
            `Couldn't update Insights workspace stanza "${stanzaName}"`,
        ),
    );
};

const deleteStanza = async (stanzaName: string): Promise<void> => {
    if (!isInSplunkRuntime()) return;
    const response = await fetch(
        `${buildBaseUrl(true)}/${encodeURIComponent(stanzaName)}?output_mode=json`,
        createFetchInit({
            method: 'DELETE',
            headers: { Accept: 'application/json' },
        }),
    );
    if (response.ok || response.status === 404) return;
    throw new Error(
        await extractErrorMessage(
            response,
            `Couldn't delete Insights workspace stanza "${stanzaName}"`,
        ),
    );
};

const workspaceFields = (workspace: InsightsWorkspace): Record<string, string> => ({
    label: workspace.label,
    source_workspace: workspace.sourceWorkspace,
    sections: workspace.sections.map((section) => section.id).join(','),
    default_visible_sections: workspace.defaultVisibleSections.join(','),
    max_visible_sections: String(workspace.maxVisibleSections),
    min_tile_count: String(workspace.minTileCount),
    max_tile_count: String(workspace.maxTileCount),
    default_tile_count: String(workspace.fallbackTileCount),
    header_title: workspace.headerTitle ?? '',
    header_subtitle: workspace.headerSubtitle ?? '',
    default_logo_src: workspace.defaultLogoSrc ?? '',
    hide_default_logo: workspace.hideDefaultLogo ? '1' : '0',
    legacy_view_names: workspace.legacyViewNames.join(','),
    is_builtin: workspace.isBuiltIn ? '1' : '0',
    enabled: workspace.enabled ? '1' : '0',
    sort_order: String(workspace.sortOrder),
    theme_preference: workspace.themePreference,
    map_visible: workspace.mapVisible ? '1' : '0',
    map_position: workspace.mapPosition,
    regional_view: workspace.regionalView,
});

export const saveInsightsWorkspace = async (
    input: WorkspaceDefinitionInput,
    layout?: WorkspaceLayoutConfig,
): Promise<InsightsWorkspace> => {
    if (!isWorkspaceId(input.id)) {
        throw new Error(
            'Workspace ID must start with a letter and contain only lowercase letters, numbers, and underscores.',
        );
    }
    const workspace = createInsightsWorkspace(input);
    await upsertStanza(workspaceStanzaName(workspace.id), workspaceFields(workspace));
    if (layout) await saveWorkspaceLayout(workspace, layout);
    return workspace;
};

export const saveWorkspaceLayout = async (
    workspace: InsightsWorkspace,
    layout: WorkspaceLayoutConfig,
): Promise<void> => {
    if (!isInSplunkRuntime()) return;
    for (const section of workspace.sections) {
        const sectionConfig = layout[section.id];
        if (!sectionConfig) continue;
        await upsertStanza(layoutStanzaName(workspace.id, section.id), {
            tiles: sectionConfig.tiles.filter((tileId) => TILE_ID_PATTERN.test(tileId)).join(','),
            searchbase_additions: splitSearchbaseAdditions(sectionConfig.searchbaseAdditions).join(','),
            visible_count: String(
                Math.min(
                    Math.max(sectionConfig.visibleCount ?? sectionConfig.tiles.length, 1),
                    workspace.maxTileCount,
                ),
            ),
        });
    }
};

export const deleteInsightsWorkspace = async (
    workspace: InsightsWorkspace,
): Promise<void> => {
    if (workspace.isBuiltIn) {
        throw new Error('Built-in workspaces cannot be deleted.');
    }
    await Promise.all(
        workspace.sections.map((section) =>
            deleteStanza(layoutStanzaName(workspace.id, section.id)),
        ),
    );
    await deleteStanza(workspaceStanzaName(workspace.id));
};
