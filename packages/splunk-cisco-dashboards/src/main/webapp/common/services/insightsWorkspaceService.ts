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
import {
    getDefaultSignalTickerConfig,
    sanitizeSignalTickerConfig,
    sanitizeSignalTickerItem,
    type SignalTickerConfig,
    type SignalTickerItem,
} from '@/common/config/signalTicker';

const APP_NAME = 'splunk-cisco-dashboards';
export const INSIGHTS_WORKSPACES_CONF_BASENAME = 'insights_workspaces';
const TILE_ID_PATTERN = /^[a-z0-9_]{1,128}$/;
const SEARCHBASE_ID_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.:-]{0,255}$/;

const WORKSPACE_STANZA_PREFIX = 'workspace.';
const LAYOUT_STANZA_PREFIX = 'layout.';
const SIGNAL_ITEM_STANZA_PREFIX = 'signal_item.';
const SIGNAL_RAIL_STANZA_PREFIX = 'signal_rail.';

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
    signalRails: Record<WorkspaceId, SignalTickerConfig>;
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

const buildReadBaseUrl = (): string =>
    `/en-US/splunkd/__raw/servicesNS/-/${APP_NAME}/configs/conf-${INSIGHTS_WORKSPACES_CONF_BASENAME}`;

const buildMutationBaseUrl = (): string =>
    `/en-US/splunkd/__raw/servicesNS/nobody/${APP_NAME}/scd_insights_workspaces`;

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

const optionalNumber = (raw: unknown): number | undefined => {
    if (raw === undefined || raw === null || raw === '') return undefined;
    const parsed = Number(raw);
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

const fallbackSignalRails = (
    workspaces: readonly InsightsWorkspace[],
): Record<WorkspaceId, SignalTickerConfig> =>
    Object.fromEntries(
        workspaces.map((workspace) => [
            workspace.id,
            getDefaultSignalTickerConfig(workspace.id),
        ]),
    );

const parseSignalItemEntries = (
    entries: readonly ConfRestEntry[],
): Map<string, SignalTickerItem> => {
    const items = new Map<string, SignalTickerItem>();
    for (const entry of entries) {
        const name = entry.name;
        if (typeof name !== 'string' || !name.startsWith(SIGNAL_ITEM_STANZA_PREFIX)) {
            continue;
        }
        const id = name.slice(SIGNAL_ITEM_STANZA_PREFIX.length);
        const content = entry.content ?? {};
        const item = sanitizeSignalTickerItem({
            id,
            searchName: content.search_name,
            label: content.label,
            valueField: content.value_field,
            thresholdWarning: optionalNumber(content.threshold_warning),
            thresholdCritical: optionalNumber(content.threshold_critical),
            thresholdDirection: content.threshold_direction,
            thresholdUnit: content.threshold_unit,
        });
        if (item) items.set(item.id, item);
    }
    return items;
};

const parseSignalRailEntries = (
    entries: readonly ConfRestEntry[],
    workspaces: readonly InsightsWorkspace[],
): Record<WorkspaceId, SignalTickerConfig> => {
    const signalRails = fallbackSignalRails(workspaces);
    const workspaceIds = new Set(workspaces.map((workspace) => workspace.id));
    const itemsById = parseSignalItemEntries(entries);

    for (const entry of entries) {
        const name = entry.name;
        if (typeof name !== 'string' || !name.startsWith(SIGNAL_RAIL_STANZA_PREFIX)) {
            continue;
        }
        const workspaceId = name.slice(SIGNAL_RAIL_STANZA_PREFIX.length);
        if (!isWorkspaceId(workspaceId) || !workspaceIds.has(workspaceId)) continue;

        const fallback = signalRails[workspaceId] ??
            getDefaultSignalTickerConfig(workspaceId);
        const content = entry.content ?? {};
        const configuredItems = splitCsv(content.items)
            .map((itemId) => itemsById.get(itemId))
            .filter((item): item is SignalTickerItem => Boolean(item))
            .map((item) => ({ ...item }));
        const hasItemsField = typeof content.items === 'string';
        const rows = optionalInt(content.rows);
        const parsed = sanitizeSignalTickerConfig({
            enabled: readBoolean(content.enabled, fallback.enabled),
            showPriorityDrilldown: readBoolean(
                content.show_priority_drilldown,
                fallback.showPriorityDrilldown,
            ),
            rows: rows === 1 || rows === 2 ? rows : fallback.rows,
            speed: optionalNumber(content.speed) ?? fallback.speed,
            density:
                content.density === 'compact' || content.density === 'comfortable'
                    ? content.density
                    : fallback.density,
            fontSize:
                content.font_size === 'small' ||
                content.font_size === 'standard' ||
                content.font_size === 'large'
                    ? content.font_size
                    : fallback.fontSize,
            items: hasItemsField ? configuredItems : fallback.items,
        });
        if (parsed) signalRails[workspaceId] = parsed;
    }

    return signalRails;
};

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

    return {
        workspaces: effectiveWorkspaces,
        layouts,
        signalRails: parseSignalRailEntries(entries, effectiveWorkspaces),
    };
};

export const loadInsightsWorkspaces = async (): Promise<InsightsWorkspaceBundle> => {
    if (!isInSplunkRuntime()) {
        const workspaces = [...PACKAGED_WORKSPACE_FALLBACKS];
        return {
            workspaces,
            layouts: {},
            signalRails: fallbackSignalRails(workspaces),
        };
    }

    const response = await fetch(`${buildReadBaseUrl()}?output_mode=json&count=0`, {
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
    const updateUrl = `${buildMutationBaseUrl()}/${encodeURIComponent(stanzaName)}`;
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
            buildMutationBaseUrl(),
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
        `${buildMutationBaseUrl()}/${encodeURIComponent(stanzaName)}?output_mode=json`,
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
    map_visible: workspace.mapVisible ? '1' : '0',
    map_position: workspace.mapPosition,
    regional_view: workspace.regionalView,
});

export class InsightsWorkspaceConflictError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InsightsWorkspaceConflictError';
    }
}

const workspaceDefinitionsEqual = (
    left: InsightsWorkspace,
    right: InsightsWorkspace,
): boolean =>
    JSON.stringify(workspaceFields(left)) === JSON.stringify(workspaceFields(right));

const normalizedLayoutSection = (
    section?: WorkspaceLayoutSection,
): WorkspaceLayoutSection | null =>
    section
        ? {
              tiles: [...section.tiles],
              visibleCount: section.visibleCount,
              searchbaseAdditions: splitSearchbaseAdditions(
                  section.searchbaseAdditions,
              ),
          }
        : null;

const layoutSectionsEqual = (
    left?: WorkspaceLayoutSection,
    right?: WorkspaceLayoutSection,
): boolean =>
    JSON.stringify(normalizedLayoutSection(left)) ===
    JSON.stringify(normalizedLayoutSection(right));

const assertWorkspaceIsCurrent = async (
    expectedWorkspace: InsightsWorkspace,
): Promise<void> => {
    if (!isInSplunkRuntime()) return;
    const latest = await loadInsightsWorkspaces();
    const current = latest.workspaces.find(
        (workspace) => workspace.id === expectedWorkspace.id,
    );
    if (!current || !workspaceDefinitionsEqual(current, expectedWorkspace)) {
        throw new InsightsWorkspaceConflictError(
            'This workspace changed after you opened the editor. Reload the page and review the latest version before saving.',
        );
    }
};

const assertLayoutIsCurrent = async (
    workspace: InsightsWorkspace,
    layout: WorkspaceLayoutConfig,
    expectedLayout: WorkspaceLayoutConfig,
): Promise<void> => {
    if (!isInSplunkRuntime()) return;
    const latest = await loadInsightsWorkspaces();
    const currentLayout = latest.layouts[workspace.id] ?? {};
    for (const section of workspace.sections) {
        if (!layout[section.id]) continue;
        if (
            !layoutSectionsEqual(
                currentLayout[section.id],
                expectedLayout[section.id],
            )
        ) {
            throw new InsightsWorkspaceConflictError(
                `The shared ${section.title} layout changed after this page loaded. Reload and review the latest version before publishing.`,
            );
        }
    }
};

export const saveInsightsWorkspace = async (
    input: WorkspaceDefinitionInput,
    layout?: WorkspaceLayoutConfig,
    expectedWorkspace?: InsightsWorkspace,
): Promise<InsightsWorkspace> => {
    if (!isWorkspaceId(input.id)) {
        throw new Error(
            'Workspace ID must start with a letter and contain only lowercase letters, numbers, and underscores.',
        );
    }
    const workspace = createInsightsWorkspace(input);
    if (expectedWorkspace) await assertWorkspaceIsCurrent(expectedWorkspace);
    await upsertStanza(workspaceStanzaName(workspace.id), workspaceFields(workspace));
    if (layout) await saveWorkspaceLayout(workspace, layout);
    return workspace;
};

export const saveWorkspaceLayout = async (
    workspace: InsightsWorkspace,
    layout: WorkspaceLayoutConfig,
    expectedLayout?: WorkspaceLayoutConfig,
): Promise<void> => {
    if (!isInSplunkRuntime()) return;
    if (expectedLayout) {
        await assertLayoutIsCurrent(workspace, layout, expectedLayout);
    }
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
    await assertWorkspaceIsCurrent(workspace);
    await Promise.all(
        workspace.sections.map((section) =>
            deleteStanza(layoutStanzaName(workspace.id, section.id)),
        ),
    );
    await deleteStanza(workspaceStanzaName(workspace.id));
};
