import type { WorkspaceId } from '@/common/config/insightsWorkspaces';

export type SignalTickerSpeed = number;
export type SignalTickerRows = 1 | 2;
export type SignalTickerDensity = 'compact' | 'comfortable';
export type SignalTickerFontSize = 'small' | 'standard' | 'large';
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
    fontSize: SignalTickerFontSize;
    items: SignalTickerItem[];
}

export interface SignalTickerPreferenceItem {
    id: string;
    searchName?: string;
    label?: string | null;
    valueField?: string | null;
    thresholdWarning?: number | null;
    thresholdCritical?: number | null;
    thresholdDirection?: SignalTickerThresholdDirection | null;
    thresholdUnit?: string | null;
}

export interface SignalTickerPreferencePatch {
    enabled?: boolean;
    showPriorityDrilldown?: boolean;
    rows?: SignalTickerRows;
    speed?: SignalTickerSpeed;
    density?: SignalTickerDensity;
    fontSize?: SignalTickerFontSize;
    /** Ordered selection with per-item deltas; shared item definitions are inherited by ID. */
    items?: SignalTickerPreferenceItem[];
}

export const MAX_SIGNAL_TICKER_ITEMS = 24;

const ID_PATTERN = /^[a-z0-9_]{1,80}$/;
const SEARCH_NAME_PATTERN = /^[\w\s\-.:()<>/&]+$/;
const FIELD_NAME_PATTERN = /^[A-Za-z_][\w.]{0,63}$/;
const UNIT_PATTERN = /^[%A-Za-z0-9_./ -]{1,16}$/;

export const DEFAULT_SIGNAL_TICKER_CONFIG: SignalTickerConfig = {
    enabled: true,
    showPriorityDrilldown: false,
    rows: 1,
    speed: 5,
    density: 'comfortable',
    fontSize: 'standard',
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
        {
            id: 'zta_auth_failure_rate',
            searchName: 'Secure Networking - ZTA ISE Authentication Failure Rate',
            label: 'ZTA auth failure rate',
            valueField: 'failed_pct',
            thresholdWarning: 5,
            thresholdCritical: 10,
            thresholdDirection: 'lower_is_better',
            thresholdUnit: '%',
        },
        {
            id: 'zta_failed_identities',
            searchName: 'Executive - Failed Logon Count (with Baseline)',
            label: 'Failed identities',
            valueField: 'total_count',
            thresholdWarning: 25,
            thresholdCritical: 100,
            thresholdDirection: 'lower_is_better',
        },
        {
            id: 'zta_auth_events',
            searchName: 'Secure Networking - ZTA ISE Authentication Events Count',
            label: 'ISE access decisions',
            valueField: 'auth_events',
        },
        {
            id: 'ise_device_footprint',
            searchName: 'Secure Networking - Infrastructure ISE Network Device Count',
            label: 'ISE policy devices',
            valueField: 'ise_device_count',
        },
        {
            id: 'sgt_active_assignments',
            searchName: 'Secure Networking - SGT Total Active Assignments Count',
            label: 'Active SGT assignments',
            valueField: 'total_assignments',
            thresholdWarning: 10,
            thresholdCritical: 1,
            thresholdDirection: 'higher_is_better',
        },
        {
            id: 'dc_critical_anomalies',
            searchName: 'Secure Networking - DC Fabric Anomaly Count',
            label: 'DC critical anomalies',
            valueField: 'critical_entities',
            thresholdWarning: 1,
            thresholdCritical: 5,
            thresholdDirection: 'lower_is_better',
        },
        {
            id: 'dc_critical_advisories',
            searchName: 'Secure Networking - DC Security Advisory Count',
            label: 'Critical PSIRT exposure',
            valueField: 'critical_count',
            thresholdWarning: 1,
            thresholdCritical: 5,
            thresholdDirection: 'lower_is_better',
        },
        {
            id: 'hmf_blocked_flows',
            searchName: 'Executive - Firewall Blocked Connections (with Baseline)',
            label: 'HMF blocked flows',
            valueField: 'total_blocked',
            thresholdWarning: 5000,
            thresholdCritical: 25000,
            thresholdDirection: 'lower_is_better',
        },
        {
            id: 'te_degraded_tests',
            searchName: 'Secure Networking - ThousandEyes Test Health Summary',
            label: 'Degraded digital paths',
            valueField: 'degraded_tests',
            thresholdWarning: 1,
            thresholdCritical: 3,
            thresholdDirection: 'lower_is_better',
        },
        {
            id: 'palo_alto_sgt_blocks',
            searchName:
                'Secure Networking - Palo Alto Policy Enforcement Trend (Signal Rail KPI)',
            label: 'Palo Alto policy blocks',
            valueField: 'Blocked',
            thresholdWarning: 10,
            thresholdCritical: 50,
            thresholdDirection: 'lower_is_better',
        },
        {
            id: 'network_health',
            searchName: 'Executive - Network Health Score Trend',
            label: 'Network health',
            valueField: 'score',
            thresholdWarning: 90,
            thresholdCritical: 70,
            thresholdDirection: 'higher_is_better',
            thresholdUnit: '%',
        },
        {
            id: 'device_health',
            searchName: 'Executive - Device Health Trend Comparison',
            label: 'Device health',
            valueField: 'current',
            thresholdWarning: 90,
            thresholdCritical: 70,
            thresholdDirection: 'higher_is_better',
            thresholdUnit: '%',
        },
        {
            id: 'it_domain_score',
            searchName: 'Executive - IT Domain Score',
            label: 'IT domain score',
            valueField: 'score',
            thresholdWarning: 90,
            thresholdCritical: 70,
            thresholdDirection: 'higher_is_better',
            thresholdUnit: '%',
        },
        {
            id: 'security_domain_score',
            searchName: 'Executive - Security Domain Score',
            label: 'Identity trust score',
            valueField: 'score',
            thresholdWarning: 95,
            thresholdCritical: 80,
            thresholdDirection: 'higher_is_better',
            thresholdUnit: '%',
        },
        {
            id: 'user_experience_score',
            searchName: 'Executive - User Experience Score',
            label: 'User experience',
            valueField: 'score',
            thresholdWarning: 90,
            thresholdCritical: 70,
            thresholdDirection: 'higher_is_better',
            thresholdUnit: '%',
        },
        {
            id: 'building_domain_score',
            searchName: 'Executive - Building Domain Score',
            label: 'Facility readiness',
            valueField: 'score',
            thresholdWarning: 85,
            thresholdCritical: 55,
            thresholdDirection: 'higher_is_better',
            thresholdUnit: '%',
        },
        {
            id: 'critical_network_issues',
            searchName: 'Executive - Issue Summary KPIs',
            label: 'Critical network issues',
            valueField: 'critical',
            thresholdWarning: 1,
            thresholdCritical: 5,
            thresholdDirection: 'lower_is_better',
        },
        {
            id: 'xdr_incidents',
            searchName: 'Executive - XDR Incident Count',
            label: 'XDR incidents',
            valueField: 'total',
            thresholdWarning: 1,
            thresholdCritical: 5,
            thresholdDirection: 'lower_is_better',
        },
    ],
};

const WORKSPACE_SIGNAL_ITEM_IDS: Record<string, readonly string[]> = {
    secure_networking: [
        'zta_auth_failure_rate',
        'dc_critical_anomalies',
        'sgt_active_assignments',
        'hmf_blocked_flows',
        'te_degraded_tests',
        'palo_alto_sgt_blocks',
    ],
    zero_trust_access_demo: [
        'zta_auth_failure_rate',
        'zta_failed_identities',
        'zta_auth_events',
        'ise_device_footprint',
        'sgt_active_assignments',
        'security_domain_score',
    ],
    network_resilience_demo: [
        'network_health',
        'device_health',
        'critical_network_issues',
        'dc_critical_anomalies',
        'dc_critical_advisories',
        'catalyst_center_age',
    ],
    security_operations_demo: [
        'xdr_incidents',
        'hmf_blocked_flows',
        'zta_failed_identities',
        'zta_auth_failure_rate',
        'dc_critical_advisories',
        'palo_alto_sgt_blocks',
    ],
    executive: [
        'it_domain_score',
        'security_domain_score',
        'user_experience_score',
        'building_domain_score',
        'critical_network_issues',
        'xdr_incidents',
    ],
};

export const cloneSignalTickerConfig = (
    config: SignalTickerConfig
): SignalTickerConfig => ({
    ...config,
    items: config.items.map((item) => ({ ...item })),
});

export const getDefaultSignalTickerConfig = (
    workspaceId: WorkspaceId
): SignalTickerConfig => {
    const itemIds = WORKSPACE_SIGNAL_ITEM_IDS[workspaceId];
    const items = itemIds
        ? itemIds
              .map((id) =>
                  DEFAULT_SIGNAL_TICKER_CONFIG.items.find((item) => item.id === id)
              )
              .filter((item): item is SignalTickerItem => Boolean(item))
              .map((item) => ({ ...item }))
        : DEFAULT_SIGNAL_TICKER_CONFIG.items.map((item) => ({ ...item }));
    return { ...DEFAULT_SIGNAL_TICKER_CONFIG, items };
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

const parseSpeed = (raw: unknown): SignalTickerSpeed | undefined => {
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        return clampSpeed(raw);
    }
    if (typeof raw === 'string') {
        const legacy = LEGACY_SPEED_MAP[raw.trim().toLowerCase()];
        if (legacy !== undefined) return legacy;
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) return clampSpeed(parsed);
    }
    return undefined;
};

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

export const sanitizeSignalTickerItem = (
    raw: unknown
): SignalTickerItem | null => {
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

const sanitizeItems = (raw: unknown): SignalTickerItem[] => {
    const rawItems = Array.isArray(raw) ? raw : [];
    const seen = new Set<string>();
    const items: SignalTickerItem[] = [];
    for (const rawItem of rawItems) {
        const item = sanitizeSignalTickerItem(rawItem);
        if (!item || seen.has(item.id)) continue;
        seen.add(item.id);
        items.push(item);
        if (items.length >= MAX_SIGNAL_TICKER_ITEMS) break;
    }
    return items;
};

const sanitizePreferenceItem = (
    raw: unknown
): SignalTickerPreferenceItem | null => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const source = raw as Record<string, unknown>;
    const id = typeof source.id === 'string' ? source.id.trim() : '';
    if (!ID_PATTERN.test(id)) return null;
    const item: SignalTickerPreferenceItem = { id };

    if (source.searchName !== undefined) {
        const searchName =
            typeof source.searchName === 'string' ? source.searchName.trim() : '';
        if (
            searchName.length === 0 ||
            searchName.length > 256 ||
            !SEARCH_NAME_PATTERN.test(searchName)
        ) {
            return null;
        }
        item.searchName = searchName;
    }
    if (source.label === null) item.label = null;
    else if (
        typeof source.label === 'string' &&
        source.label.trim().length > 0 &&
        source.label.trim().length <= 80
    ) {
        item.label = source.label.trim();
    }
    if (source.valueField === null) item.valueField = null;
    else if (
        typeof source.valueField === 'string' &&
        FIELD_NAME_PATTERN.test(source.valueField.trim())
    ) {
        item.valueField = source.valueField.trim();
    }
    if (source.thresholdWarning === null) item.thresholdWarning = null;
    else if (
        typeof source.thresholdWarning === 'number' &&
        Number.isFinite(source.thresholdWarning)
    ) {
        item.thresholdWarning = source.thresholdWarning;
    }
    if (source.thresholdCritical === null) item.thresholdCritical = null;
    else if (
        typeof source.thresholdCritical === 'number' &&
        Number.isFinite(source.thresholdCritical)
    ) {
        item.thresholdCritical = source.thresholdCritical;
    }
    if (source.thresholdDirection === null) item.thresholdDirection = null;
    else if (
        source.thresholdDirection === 'higher_is_better' ||
        source.thresholdDirection === 'lower_is_better'
    ) {
        item.thresholdDirection = source.thresholdDirection;
    }
    if (source.thresholdUnit === null) item.thresholdUnit = null;
    else if (
        typeof source.thresholdUnit === 'string' &&
        UNIT_PATTERN.test(source.thresholdUnit.trim())
    ) {
        item.thresholdUnit = source.thresholdUnit.trim();
    }
    return item;
};

const sanitizePreferenceItems = (raw: unknown): SignalTickerPreferenceItem[] => {
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    const items: SignalTickerPreferenceItem[] = [];
    for (const candidate of raw) {
        const item = sanitizePreferenceItem(candidate);
        if (!item || seen.has(item.id)) continue;
        seen.add(item.id);
        items.push(item);
        if (items.length >= MAX_SIGNAL_TICKER_ITEMS) break;
    }
    return items;
};

export const sanitizeSignalTickerConfig = (
    raw: unknown
): SignalTickerConfig | null => {
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
    const speed = parseSpeed(source.speed) ?? DEFAULT_SIGNAL_TICKER_CONFIG.speed;
    const density: SignalTickerDensity =
        source.density === 'compact' || source.density === 'comfortable'
            ? source.density
            : DEFAULT_SIGNAL_TICKER_CONFIG.density;
    const fontSize: SignalTickerFontSize =
        source.fontSize === 'small' || source.fontSize === 'large'
            ? source.fontSize
            : 'standard';
    return {
        enabled,
        showPriorityDrilldown,
        rows,
        speed,
        density,
        fontSize,
        items: sanitizeItems(source.items),
    };
};

export const sanitizeSignalTickerPreferencePatch = (
    raw: unknown
): SignalTickerPreferencePatch | null => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const source = raw as Record<string, unknown>;
    const patch: SignalTickerPreferencePatch = {};
    if (typeof source.enabled === 'boolean') patch.enabled = source.enabled;
    if (typeof source.showPriorityDrilldown === 'boolean') {
        patch.showPriorityDrilldown = source.showPriorityDrilldown;
    }
    if (source.rows === 1 || source.rows === 2) patch.rows = source.rows;
    const speed = parseSpeed(source.speed);
    if (speed !== undefined) patch.speed = speed;
    if (source.density === 'compact' || source.density === 'comfortable') {
        patch.density = source.density;
    }
    if (
        source.fontSize === 'small' ||
        source.fontSize === 'standard' ||
        source.fontSize === 'large'
    ) {
        patch.fontSize = source.fontSize;
    }
    if (Array.isArray(source.items)) {
        patch.items = sanitizePreferenceItems(source.items);
    }
    return patch;
};

const sameItems = (
    left: readonly SignalTickerItem[],
    right: readonly SignalTickerItem[]
): boolean => JSON.stringify(left) === JSON.stringify(right);

export const signalTickerConfigsEqual = (
    left: SignalTickerConfig,
    right: SignalTickerConfig
): boolean =>
    left.enabled === right.enabled &&
    left.showPriorityDrilldown === right.showPriorityDrilldown &&
    left.rows === right.rows &&
    left.speed === right.speed &&
    left.density === right.density &&
    left.fontSize === right.fontSize &&
    sameItems(left.items, right.items);

export const createSignalTickerPreferencePatch = (
    base: SignalTickerConfig,
    current: SignalTickerConfig
): SignalTickerPreferencePatch | null => {
    const patch: SignalTickerPreferencePatch = {};
    if (current.enabled !== base.enabled) patch.enabled = current.enabled;
    if (current.showPriorityDrilldown !== base.showPriorityDrilldown) {
        patch.showPriorityDrilldown = current.showPriorityDrilldown;
    }
    if (current.rows !== base.rows) patch.rows = current.rows;
    if (current.speed !== base.speed) patch.speed = current.speed;
    if (current.density !== base.density) patch.density = current.density;
    if (current.fontSize !== base.fontSize) patch.fontSize = current.fontSize;
    if (!sameItems(current.items, base.items)) {
        const baseById = new Map(base.items.map((item) => [item.id, item]));
        patch.items = current.items.map((item) => {
            const inherited = baseById.get(item.id);
            const delta: SignalTickerPreferenceItem = { id: item.id };
            if (!inherited || item.searchName !== inherited.searchName) {
                delta.searchName = item.searchName;
            }
            if (item.label !== inherited?.label) {
                delta.label = item.label ?? null;
            }
            if (item.valueField !== inherited?.valueField) {
                delta.valueField = item.valueField ?? null;
            }
            if (item.thresholdWarning !== inherited?.thresholdWarning) {
                delta.thresholdWarning = item.thresholdWarning ?? null;
            }
            if (item.thresholdCritical !== inherited?.thresholdCritical) {
                delta.thresholdCritical = item.thresholdCritical ?? null;
            }
            if (item.thresholdDirection !== inherited?.thresholdDirection) {
                delta.thresholdDirection = item.thresholdDirection ?? null;
            }
            if (item.thresholdUnit !== inherited?.thresholdUnit) {
                delta.thresholdUnit = item.thresholdUnit ?? null;
            }
            return delta;
        });
    }
    return Object.keys(patch).length > 0 ? patch : null;
};

export const applySignalTickerPreferencePatch = (
    base: SignalTickerConfig,
    patch: SignalTickerPreferencePatch | null
): SignalTickerConfig => {
    if (!patch) return cloneSignalTickerConfig(base);
    const baseById = new Map(base.items.map((item) => [item.id, item]));
    const items = patch.items
        ? patch.items
              .map((delta): SignalTickerItem | null => {
                  const inherited = baseById.get(delta.id);
                  const searchName = delta.searchName ?? inherited?.searchName;
                  if (!searchName) return null;
                  const candidate: Record<string, unknown> = {
                      ...(inherited ?? {}),
                      id: delta.id,
                      searchName,
                  };
                  for (const key of [
                      'label',
                      'valueField',
                      'thresholdWarning',
                      'thresholdCritical',
                      'thresholdDirection',
                      'thresholdUnit',
                  ] as const) {
                      const value = delta[key];
                      if (value === null) delete candidate[key];
                      else if (value !== undefined) candidate[key] = value;
                  }
                  return sanitizeSignalTickerItem(candidate);
              })
              .filter((item): item is SignalTickerItem => Boolean(item))
        : base.items;
    return (
        sanitizeSignalTickerConfig({
            ...base,
            ...patch,
            items,
        }) ?? cloneSignalTickerConfig(base)
    );
};

const isLegacyFactorySignalTickerConfig = (config: SignalTickerConfig): boolean =>
    LEGACY_FACTORY_SIGNAL_TICKER_ID_SETS.some(
        (ids) =>
            config.items.length === ids.size &&
            config.items.every((item) => ids.has(item.id))
    );

export const migrateSignalTickerConfig = (
    config: SignalTickerConfig,
    factoryConfig: SignalTickerConfig
): SignalTickerConfig => {
    if (isLegacyFactorySignalTickerConfig(config)) {
        return cloneSignalTickerConfig(factoryConfig);
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
