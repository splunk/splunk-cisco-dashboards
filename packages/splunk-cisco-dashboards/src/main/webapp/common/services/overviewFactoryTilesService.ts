import { createFetchInit } from '@splunk/splunk-utils/fetch';

import type { SectionId } from '@/common/hooks/useMetric';

const APP_NAME = 'splunk-cisco-dashboards';
const CONF_BASENAME = 'overview_factory_tiles';
const SECTION_IDS: readonly SectionId[] = [
    'it_health',
    'security',
    'building',
    'custom',
] as const;
const TILE_ID_PATTERN = /^[a-z0-9_]{1,64}$/;

export interface OverviewFactorySection {
    tiles: string[];
    visibleCount?: number;
}

export type OverviewFactoryTilesConfig = Partial<
    Record<SectionId, OverviewFactorySection>
>;

interface ConfRestEntry {
    name?: string;
    content?: Record<string, unknown>;
}

const isSectionId = (raw: unknown): raw is SectionId =>
    typeof raw === 'string' && (SECTION_IDS as readonly string[]).includes(raw);

const isInSplunkRuntime = (): boolean => {
    if (typeof window === 'undefined') return false;
    const runtime = window as unknown as { __SPLUNK_RUNTIME__?: boolean; $C?: unknown };
    if (runtime.__SPLUNK_RUNTIME__ === false) return false;
    if (runtime.__SPLUNK_RUNTIME__ === true) return true;
    return Boolean(runtime.$C) || Boolean(document.cookie?.includes('splunkweb_csrf_token'));
};

const buildBaseUrl = (forWrite: boolean): string => {
    const owner = forWrite ? 'nobody' : '-';
    return `/en-US/splunkd/__raw/servicesNS/${owner}/${APP_NAME}/configs/conf-${CONF_BASENAME}`;
};

const getCurrentUser = (): string => {
    if (typeof window === 'undefined') return 'unknown';
    const $C = (window as unknown as { $C?: Record<string, unknown> }).$C;
    const username = $C?.USERNAME;
    return typeof username === 'string' && username.trim()
        ? username.trim()
        : 'unknown';
};

const optionalString = (raw: unknown): string | undefined =>
    typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;

const optionalInt = (raw: unknown): number | undefined => {
    if (raw === undefined || raw === null) return undefined;
    const parsed = Number.parseInt(String(raw), 10);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const splitTiles = (raw: unknown): string[] => {
    const value = optionalString(raw);
    if (!value) return [];
    const seen = new Set<string>();
    const tiles: string[] = [];
    for (const part of value.split(',')) {
        const id = part.trim();
        if (!TILE_ID_PATTERN.test(id) || seen.has(id)) continue;
        seen.add(id);
        tiles.push(id);
    }
    return tiles;
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
        return detail ? `${fallback}: ${detail}` : `${fallback}: HTTP ${response.status}`;
    } catch {
        return `${fallback}: HTTP ${response.status}`;
    }
};

export const loadOverviewFactoryTiles = async (): Promise<OverviewFactoryTilesConfig> => {
    if (!isInSplunkRuntime()) return {};

    const response = await fetch(`${buildBaseUrl(false)}?output_mode=json&count=0`, {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
        throw new Error(
            await extractErrorMessage(response, "Couldn't load Overview factory tiles")
        );
    }

    const json = (await response.json()) as { entry?: ConfRestEntry[] };
    const entries = Array.isArray(json.entry) ? json.entry : [];
    const next: OverviewFactoryTilesConfig = {};
    for (const entry of entries) {
        if (!isSectionId(entry.name)) continue;
        const content = entry.content ?? {};
        const tiles = splitTiles(content.tiles);
        const visibleCount = optionalInt(content.visible_count);
        next[entry.name] = {
            tiles,
            visibleCount:
                visibleCount !== undefined
                    ? Math.min(Math.max(visibleCount, 1), 99)
                    : undefined,
        };
    }
    return next;
};

const upsertSection = async (
    section: SectionId,
    config: OverviewFactorySection
): Promise<void> => {
    const body = new URLSearchParams({
        tiles: config.tiles.join(','),
        visible_count: String(config.visibleCount ?? config.tiles.length),
        updated_at: new Date().toISOString(),
        updated_by: getCurrentUser(),
        output_mode: 'json',
    });
    const updateUrl = `${buildBaseUrl(true)}/${encodeURIComponent(section)}`;
    const postInit = createFetchInit({
        method: 'POST',
        body: body.toString(),
        headers: { Accept: 'application/json' },
    });

    const response = await fetch(updateUrl, postInit);
    if (response.ok) return;

    if (response.status === 404) {
        const createBody = new URLSearchParams(body);
        createBody.set('name', section);
        const createInit = createFetchInit({
            method: 'POST',
            body: createBody.toString(),
            headers: { Accept: 'application/json' },
        });
        const createResponse = await fetch(buildBaseUrl(true), createInit);
        if (createResponse.ok) return;
        throw new Error(
            await extractErrorMessage(
                createResponse,
                `Couldn't save Overview factory tiles for ${section}`
            )
        );
    }

    throw new Error(
        await extractErrorMessage(
            response,
            `Couldn't save Overview factory tiles for ${section}`
        )
    );
};

const deleteSectionLocalOverride = async (section: SectionId): Promise<void> => {
    if (!isInSplunkRuntime()) return;

    const deleteUrl = `${buildBaseUrl(true)}/${encodeURIComponent(
        section
    )}?output_mode=json`;
    const deleteInit = createFetchInit({
        method: 'DELETE',
        headers: { Accept: 'application/json' },
    });

    const response = await fetch(deleteUrl, deleteInit);
    if (response.ok || response.status === 404) return;

    throw new Error(
        await extractErrorMessage(
            response,
            `Couldn't reset Overview factory tiles for ${section}`
        )
    );
};

export const saveOverviewFactoryTiles = async (
    config: OverviewFactoryTilesConfig
): Promise<void> => {
    if (!isInSplunkRuntime()) return;

    for (const section of SECTION_IDS) {
        const sectionConfig = config[section];
        if (!sectionConfig) continue;
        await upsertSection(section, sectionConfig);
    }
};

export const resetOverviewFactoryTiles = async (): Promise<void> => {
    if (!isInSplunkRuntime()) return;

    await Promise.all(
        SECTION_IDS.map((section) => deleteSectionLocalOverride(section))
    );
};
