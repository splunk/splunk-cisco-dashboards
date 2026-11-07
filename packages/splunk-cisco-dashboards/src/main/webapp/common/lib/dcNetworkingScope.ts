/** Shared by workspace tiles, their detail/Search pivots, and Manager sources. */
export interface DcNetworkingScope {
    account?: string;
    fabric?: string;
    device?: string;
}

export const DC_SCOPE_MARKER = '| eval DCWorkspaceScope=1';

export const normalizeDcScopeValue = (raw: unknown): string => {
    if (raw === undefined || raw === null || raw === '' || raw === '*') { return ''; }
    // A positive character allowlist prevents SPL, macro and token injection.
    // Empty means all; other values are exact, case-insensitive identities.
    if (typeof raw !== 'string' || raw.length > 128 ||
        !/^[a-zA-Z0-9_.:/@ ()[\]-]+$/.test(raw)) {
        throw new Error('Use an exact name or address (up to 128 characters); leave blank for all.');
    }
    return raw.trim().toLowerCase();
};

export const applyDcNetworkingScope = (search: string, scope: DcNetworkingScope = {}): string => {
    if (!search.includes(DC_SCOPE_MARKER)) { return search; }
    const filters = (['account', 'fabric', 'device'] as const).flatMap((key) => {
        const value = normalizeDcScopeValue(scope[key]);
        if (!value) { return []; }
        const fields = { fabric: ['Fabric', 'FabricId'], device: ['Device', 'DeviceId', 'DeviceAddress', 'DevicePeer', 'DevicePeerId'], account: ['Account', 'Controller'] }[key];
        return [`(${fields.map((field) => `lower(${field})=${JSON.stringify(value)}`).join(' OR ')})`];
    });
    return filters.length ? search.replace(DC_SCOPE_MARKER,
        `${DC_SCOPE_MARKER}\n| where ${filters.join(' AND ')}`) : search;
};

/** Only the new scoped sources opt into this URL/default handoff contract. */
export const applyDcDashboardHandoff = <T extends {
    inputs?: Record<string, { options?: Record<string, unknown> }>;
    dataSources?: Record<string, { options?: Record<string, unknown> }>;
}>(definition: T, params: URLSearchParams): T => {
    if (!Object.values(definition.dataSources || {}).some((source) => source.options?.dcScope)) { return definition; }
    const inputs = { ...definition.inputs };
    Object.entries(inputs).forEach(([id, input]) => {
        const token = String(input.options?.token || '');
        if (['dc_account', 'dc_fabric', 'dc_device'].includes(token)) {
            const value = params.get(`form.${token}`);
            // Preserve invalid values in the input: the dispatcher rejects them
            // before creating a job, and the operator can correct the input.
            if (value !== null) { inputs[id] = { ...input, options: { ...input.options, defaultValue: value } }; }
        } else if (token === 'time_tok') {
            const earliest = params.get('form.time_tok.earliest');
            const latest = params.get('form.time_tok.latest');
            const safeTime = (value: string | null): value is string => value !== null && value.length <= 128 && /^[A-Za-z0-9@._:+\-*/ ]+$/.test(value);
            if (safeTime(earliest) && safeTime(latest)) {
                inputs[id] = { ...input, options: { ...input.options, defaultValue: `${earliest},${latest},auto` } };
            }
        }
    });
    return { ...definition, inputs };
};

export const dcScopeDashboardUrl = (scope: DcNetworkingScope, earliest: string, latest: string): string => {
    const params = new URLSearchParams({ 'form.time_tok.earliest': earliest, 'form.time_tok.latest': latest });
    (['account', 'fabric', 'device'] as const).forEach((key) => {
        const value = normalizeDcScopeValue(scope[key]);
        if (value) { params.set(`form.dc_${key}`, value); }
    });
    return `dashboard_manager?${params.toString()}#/dc_networking_operations`;
};
