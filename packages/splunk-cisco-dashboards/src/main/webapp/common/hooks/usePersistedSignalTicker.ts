import { useCallback, useEffect, useMemo, useState } from 'react';

export type SignalTickerSpeed = number;
export type SignalTickerRows = 1 | 2;
export type SignalTickerDensity = 'compact' | 'comfortable';
export type SignalTickerThresholdDirection =
    | 'higher_is_better'
    | 'lower_is_better';

export interface SignalTickerItem {
    id: string;
    searchName: string;
    label?: string;
    valueField?: string;
    thresholdWarning?: number;
    thresholdCritical?: number;
    thresholdDirection?: SignalTickerThresholdDirection;
    thresholdUnit?: string;
}

export interface SignalTickerConfig {
    enabled: boolean;
    showPriorityDrilldown: boolean;
    rows: SignalTickerRows;
    speed: SignalTickerSpeed;
    density: SignalTickerDensity;
    items: SignalTickerItem[];
}

const STORAGE_KEY = 'splunk-cisco-dashboards.signalTicker.v1';
const STORAGE_VERSION = 2;

const ID_PATTERN = /^[a-z0-9_]{1,80}$/;
const SEARCH_NAME_PATTERN = /^[\w\s\-.:()<>/&]+$/;
const FIELD_NAME_PATTERN = /^[A-Za-z_][\w.]{0,63}$/;
const UNIT_PATTERN = /^[%A-Za-z0-9_./ -]{1,16}$/;

const DEFAULT_SIGNAL_TICKER_CONFIG: SignalTickerConfig = {
    enabled: true,
    showPriorityDrilldown: false,
    rows: 1,
    speed: 5,
    density: 'compact',
    items: [
        {
            id: 'thousandeyes_stream_age',
            searchName:
                'Feed Monitor - ThousandEyes - Stream Staleness (Signal Rail KPI)',
            label: 'TE stream age',
            valueField: 'age_minutes',
            thresholdWarning: 30,
            thresholdCritical: 90,
            thresholdDirection: 'lower_is_better',
            thresholdUnit: 'm',
        },
        {
            id: 'ftd_firewall_age',
            searchName:
                'Feed Monitor - FTD Firewall - Stream Staleness (Signal Rail KPI)',
            label: 'FTD feed age',
            valueField: 'age_minutes',
            thresholdWarning: 30,
            thresholdCritical: 90,
            thresholdDirection: 'lower_is_better',
            thresholdUnit: 'm',
        },
        {
            id: 'fmc_estreamer_age',
            searchName:
                'Feed Monitor - FMC eStreamer - IPS Feed Staleness (Signal Rail KPI)',
            label: 'FMC IPS age',
            valueField: 'age_minutes',
            thresholdWarning: 60,
            thresholdCritical: 180,
            thresholdDirection: 'lower_is_better',
            thresholdUnit: 'm',
        },
        {
            id: 'ise_syslog_age',
            searchName:
                'Feed Monitor - ISE - RADIUS Syslog Staleness (Signal Rail KPI)',
            label: 'ISE syslog age',
            valueField: 'age_minutes',
            thresholdWarning: 30,
            thresholdCritical: 90,
            thresholdDirection: 'lower_is_better',
            thresholdUnit: 'm',
        },
        {
            id: 'catalyst_center_age',
            searchName:
                'Feed Monitor - Catalyst Center - API Feed Staleness (Signal Rail KPI)',
            label: 'Catalyst API age',
            valueField: 'age_minutes',
            thresholdWarning: 60,
            thresholdCritical: 180,
            thresholdDirection: 'lower_is_better',
            thresholdUnit: 'm',
        },
        {
            id: 'spaces_firehose_age',
            searchName:
                'Feed Monitor - Cisco Spaces - Firehose Staleness (Signal Rail KPI)',
            label: 'Spaces feed age',
            valueField: 'age_minutes',
            thresholdWarning: 90,
            thresholdCritical: 240,
            thresholdDirection: 'lower_is_better',
            thresholdUnit: 'm',
        },
    ],
};

const LEGACY_FACTORY_SIGNAL_TICKER_ID_SETS = [
    new Set([
        'event_ops_feeds_active',
        'catalyst_active_issues',
        'catalyst_compliance_ready',
        'fmc_ips_ready',
        'thousandeyes_feed_ready',
        'duo_auth_ready',
    ]),
    // Build 2026-06-16 briefly defaulted the Signal Rail to the same
    // searchbase entries used by the factory Overview section tiles.
    // Treat that exact six-item selection as a factory preset so it
    // migrates to the dedicated feed-monitor rail without replacing a
    // genuinely customized operator rail.
    new Set([
        'critical_sites_available',
        'network_health',
        'active_issues',
        'xdr_critical',
        'failed_auth',
        'threat_sources',
    ]),
];

const RENAMED_SEARCH_NAMES = new Map([
    [
        'Cisco Live - Event Ops - Onboarding Gap Summary KPI',
        'Event Ops - Onboarding Gap Summary KPI',
    ],
]);

const LEGACY_SPEED_MAP: Record<string, SignalTickerSpeed> = {
    slow: 3,
    normal: 5,
    fast: 8,
};

const clampSpeed = (value: number): SignalTickerSpeed =>
    Math.min(10, Math.max(0, Math.round(value)));

const sanitizeSpeed = (raw: unknown): SignalTickerSpeed => {
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        return clampSpeed(raw);
    }
    if (typeof raw === 'string') {
        const legacy = LEGACY_SPEED_MAP[raw.trim().toLowerCase()];
        if (legacy !== undefined) {
            return legacy;
        }
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) {
            return clampSpeed(parsed);
        }
    }
    return DEFAULT_SIGNAL_TICKER_CONFIG.speed;
};

interface PersistedShape {
    v: number;
    config: SignalTickerConfig;
}

const normalizeId = (value: string): string =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 64) || 'ticker_item';

export const makeSignalTickerItemId = (
    searchName: string,
    existingIds: Iterable<string>
): string => {
    const used = new Set(existingIds);
    const base = normalizeId(searchName);
    let candidate = base;
    let idx = 2;
    while (used.has(candidate)) {
        candidate = `${base}_${idx}`;
        idx += 1;
    }
    return candidate;
};

const sanitizeItem = (raw: unknown): SignalTickerItem | null => {
    if (!raw || typeof raw !== 'object') return null;
    const source = raw as Record<string, unknown>;
    const id = typeof source.id === 'string' ? source.id.trim() : '';
    const searchName =
        typeof source.searchName === 'string' ? source.searchName.trim() : '';
    if (!ID_PATTERN.test(id)) return null;
    if (
        searchName.length === 0 ||
        searchName.length > 256 ||
        !SEARCH_NAME_PATTERN.test(searchName)
    ) {
        return null;
    }
    const item: SignalTickerItem = { id, searchName };
    if (
        typeof source.label === 'string' &&
        source.label.trim().length > 0 &&
        source.label.trim().length <= 80
    ) {
        item.label = source.label.trim();
    }
    if (
        typeof source.valueField === 'string' &&
        FIELD_NAME_PATTERN.test(source.valueField.trim())
    ) {
        item.valueField = source.valueField.trim();
    }
    if (
        typeof source.thresholdWarning === 'number' &&
        Number.isFinite(source.thresholdWarning)
    ) {
        item.thresholdWarning = source.thresholdWarning;
    }
    if (
        typeof source.thresholdCritical === 'number' &&
        Number.isFinite(source.thresholdCritical)
    ) {
        item.thresholdCritical = source.thresholdCritical;
    }
    if (
        source.thresholdDirection === 'higher_is_better' ||
        source.thresholdDirection === 'lower_is_better'
    ) {
        item.thresholdDirection = source.thresholdDirection;
    }
    if (
        typeof source.thresholdUnit === 'string' &&
        UNIT_PATTERN.test(source.thresholdUnit.trim())
    ) {
        item.thresholdUnit = source.thresholdUnit.trim();
    }
    return item;
};

const sanitizeConfig = (raw: unknown): SignalTickerConfig | null => {
    if (!raw || typeof raw !== 'object') return null;
    const source = raw as Record<string, unknown>;
    const enabled =
        typeof source.enabled === 'boolean'
            ? source.enabled
            : DEFAULT_SIGNAL_TICKER_CONFIG.enabled;
    const showPriorityDrilldown =
        typeof source.showPriorityDrilldown === 'boolean'
            ? source.showPriorityDrilldown
            : DEFAULT_SIGNAL_TICKER_CONFIG.showPriorityDrilldown;
    const rows: SignalTickerRows = source.rows === 2 ? 2 : 1;
    const speed = sanitizeSpeed(source.speed);
    const density: SignalTickerDensity =
        source.density === 'comfortable' ? 'comfortable' : 'compact';
    const rawItems = Array.isArray(source.items) ? source.items : [];
    const seen = new Set<string>();
    const items: SignalTickerItem[] = [];
    for (const rawItem of rawItems) {
        const item = sanitizeItem(rawItem);
        if (!item || seen.has(item.id)) continue;
        seen.add(item.id);
        items.push(item);
        if (items.length >= 24) break;
    }
    return { enabled, showPriorityDrilldown, rows, speed, density, items };
};

const isLegacyFactorySignalTickerConfig = (config: SignalTickerConfig): boolean =>
    LEGACY_FACTORY_SIGNAL_TICKER_ID_SETS.some(
        (ids) =>
            config.items.length === ids.size &&
            config.items.every((item) => ids.has(item.id))
    );

const migrateSignalTickerConfig = (
    config: SignalTickerConfig
): SignalTickerConfig => {
    if (isLegacyFactorySignalTickerConfig(config)) {
        return DEFAULT_SIGNAL_TICKER_CONFIG;
    }

    let changed = false;
    const items = config.items.map((item) => {
        const searchName = RENAMED_SEARCH_NAMES.get(item.searchName);
        if (!searchName) return item;
        changed = true;
        return { ...item, searchName };
    });

    return changed ? { ...config, items } : config;
};

const readFromStorage = (): SignalTickerConfig => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return DEFAULT_SIGNAL_TICKER_CONFIG;
    }
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_SIGNAL_TICKER_CONFIG;
        const parsed = JSON.parse(raw) as Partial<PersistedShape>;
        if (!parsed || parsed.v !== STORAGE_VERSION) {
            return DEFAULT_SIGNAL_TICKER_CONFIG;
        }
        const sanitized = sanitizeConfig(parsed.config);
        return sanitized
            ? migrateSignalTickerConfig(sanitized)
            : DEFAULT_SIGNAL_TICKER_CONFIG;
    } catch {
        return DEFAULT_SIGNAL_TICKER_CONFIG;
    }
};

const writeToStorage = (config: SignalTickerConfig): void => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        const payload: PersistedShape = { v: STORAGE_VERSION, config };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
        // Storage may be unavailable; the ticker still works for this session.
    }
};

export interface UsePersistedSignalTickerResult {
    config: SignalTickerConfig;
    setConfig: (config: SignalTickerConfig) => void;
    resetAll: () => void;
    itemCount: number;
}

export const usePersistedSignalTicker =
    (): UsePersistedSignalTickerResult => {
        const [config, setConfigState] = useState<SignalTickerConfig>(() =>
            readFromStorage()
        );

        useEffect(() => {
            if (typeof window === 'undefined') return undefined;
            const onStorage = (event: StorageEvent) => {
                if (event.key !== STORAGE_KEY) return;
                setConfigState(readFromStorage());
            };
            window.addEventListener('storage', onStorage);
            return () => window.removeEventListener('storage', onStorage);
        }, []);

        const setConfig = useCallback((nextConfig: SignalTickerConfig) => {
            const sanitized = sanitizeConfig(nextConfig);
            if (!sanitized) return;
            writeToStorage(sanitized);
            setConfigState(sanitized);
        }, []);

        const resetAll = useCallback(() => {
            writeToStorage(DEFAULT_SIGNAL_TICKER_CONFIG);
            setConfigState(DEFAULT_SIGNAL_TICKER_CONFIG);
        }, []);

        const itemCount = useMemo(
            () => config.items.length,
            [config.items.length]
        );

        return { config, setConfig, resetAll, itemCount };
    };

export { DEFAULT_SIGNAL_TICKER_CONFIG };
