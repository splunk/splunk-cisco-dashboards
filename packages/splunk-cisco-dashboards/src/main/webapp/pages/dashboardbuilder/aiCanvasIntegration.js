import { createRESTURL, createURL } from '@splunk/splunk-utils/url';
import { getDefaultFetchInit } from '@splunk/splunk-utils/fetch';
import { app, username } from '@splunk/splunk-utils/config';

// Matches the Splunk 10.6 Studio handoff. No Canvas credentials are persisted.
export const CANVAS_PREVIEW_ROWS = 100;
const SEARCH_TYPES = new Set(['ds.search', 'ds.chain', 'ds.savedSearch', 'ds.searchbase']);
const REQUEST_TIMEOUT = 15000;
const CACHE_TIME = 5 * 60 * 1000;

export const isCanvasSource = (source) => SEARCH_TYPES.has(source?.type);
const enabled = (value) => value === true || value === 1 || value === '1' || value === 'true';
const firstContent = (data) => data?.entry?.[0]?.content || {};
const encode = encodeURIComponent;

export function httpsUrl(value) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) {
        throw new Error('The Cisco Cloud Control endpoint must use HTTPS.');
    }
    return url;
}

export function firstObservable(source) {
    return new Promise((resolve, reject) => {
        let subscription;
        let settled = false;
        const finish = (error, value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            subscription?.unsubscribe();
            if (error) reject(error);
            else resolve(value);
        };
        const timer = setTimeout(() => finish(new Error('The panel search is not ready. Try again.')), REQUEST_TIMEOUT);
        try {
            subscription = source?.subscribe({
                next: (value) => finish(null, value),
                error: (error) => finish(error),
                complete: () => finish(new Error('The panel search has no search job.')),
            });
            if (!subscription) finish(new Error('The panel search has no search job.'));
            if (settled) subscription?.unsubscribe();
        } catch (error) {
            finish(error);
        }
    });
}

export const panelController = (dashboardApi, id) =>
    (dashboardApi?.getDataSourceRegistry?.() || dashboardApi?.dataSourceRegistry)
        ?.getDataSourceController(id);

export async function panelSearchId(dashboardApi, itemDefinition) {
    const id = itemDefinition?.dataSources?.primary;
    const controller = panelController(dashboardApi, id);
    const metaSid = dashboardApi?.getDataSourceMetaData?.(id)?.sid;
    if (typeof metaSid === 'string' && metaSid) return metaSid;
    const source = controller?.dataSource;
    const sid = await firstObservable(source?.getSid?.() || source?.searchJob?.getSid() || source?.splunkSearch?.searchJob?.getSid());
    if (typeof sid !== 'string' || !sid) throw new Error('The panel search is not ready. Try again.');
    return sid;
}

// Resolve chain roots through their running controllers, including Searchbase's
// resolved SPL and submitted tokens. Never dispatch another search for a handoff.
export function resolvePanelQuery(dashboardApi, dataSources, id, visited = new Set()) {
    if (!id || visited.has(id)) throw new Error('The panel has an invalid search chain.');
    visited.add(id);
    const controller = panelController(dashboardApi, id);
    const source = controller?.def || dataSources?.[id];
    if (!isCanvasSource(source)) throw new Error('This panel does not have a supported search.');
    const runtime = controller?.dataSource;
    const query = runtime?.options?.search || runtime?.options?.query || source.options?.query;
    if (source.type === 'ds.chain') {
        const base = resolvePanelQuery(dashboardApi, dataSources, source.options?.extend, visited);
        if (typeof query !== 'string' || !query.trim()) throw new Error('The panel search is not ready. Try again.');
        return `${base}\n${query}`;
    }
    if (typeof query !== 'string' || !query.trim()) throw new Error('The panel search is not ready. Try again.');
    return query;
}

export function chainPostprocess(dashboardApi, dataSources, id, seen = new Set()) {
    if (!id || seen.has(id)) throw new Error('The panel has an invalid search chain.');
    seen.add(id);
    const controller = panelController(dashboardApi, id);
    const source = controller?.def || dataSources?.[id];
    if (source?.type !== 'ds.chain') return '';
    const query = controller?.dataSource?.options?.search || controller?.dataSource?.options?.query || source.options?.query;
    return `${chainPostprocess(dashboardApi, dataSources, source.options?.extend, seen)}\n${query || ''}`.trim();
}

export function canvasVisualization(type) {
    return ({
        'splunk.table': 'table', 'splunk.singlevalue': 'singlevalue',
        'splunk.line': 'line', 'splunk.area': 'area', 'splunk.pie': 'pie',
        'splunk.bar': 'bar', 'splunk.column': 'bar', 'splunk.map': 'map',
    })[type] || 'table';
}

export function buildCanvasCard(panel, title) {
    const props = {
        resultsData: panel.resultsData,
        searchMetadata: panel.searchMetadata,
        vizOptions: { vizType: canvasVisualization(panel.type) },
    };
    if (panel.savedSearch) props.savedSearch = { type: 'report', ...panel.savedSearch };
    return { cards: [{
        sources: [{ name: 'spl', query: panel.searchMetadata.query.query }],
        userData: { text: { content: JSON.stringify({ vizOptions: props.vizOptions }), contentType: 'SPL_WIDGET_TEXT' } },
        position: { width: 200, height: 200 },
        data: { name: 'SplunkGeneric', props },
        metadata: { cardType: 'SPL', runbook: { runbookId: '', trajectoryId: '', executionStepId: 0 }, toolName: '', toolIds: [] },
        title, productName: 'Splunk',
    }] };
}

export function createCanvasIntegration({ fetchImpl = (...args) => fetch(...args), currentApp = app, currentUser = username } = {}) {
    let eligibility;
    let eligibilityAt = 0;
    let endpoint;

    async function json(url, init = {}, message = 'The request failed. Try again.') {
        const timeout = new AbortController();
        const abort = () => timeout.abort();
        init.signal?.addEventListener('abort', abort, { once: true });
        if (init.signal?.aborted) abort();
        const timer = setTimeout(abort, REQUEST_TIMEOUT);
        try {
            const response = await fetchImpl(url, { ...init, signal: timeout.signal, redirect: 'error' });
            if (!response.ok) throw new Error(`${message} (HTTP ${response.status})`);
            return await response.json();
        } catch (error) {
            if (error.name === 'AbortError') throw new Error('The request was interrupted. Check AI Canvas before trying again.');
            throw error;
        } finally {
            clearTimeout(timer);
            init.signal?.removeEventListener('abort', abort);
        }
    }

    const local = (path, namespace, init, message) => json(
        createRESTURL(path, namespace), { ...getDefaultFetchInit(), ...init }, message,
    );

    async function eligibilityFallback(features) {
        const tokens = await local('authorization/tokens?output_mode=json', undefined, {
            method: 'POST', body: new URLSearchParams({ type: 'cui' }).toString(),
            headers: { ...getDefaultFetchInit().headers, 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        const token = tokens.entry?.[0]?.content?.token;
        if (!token) return false;
        const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        const issuer = httpsUrl(claims.iss);
        const user = await json(`${issuer.origin}/oauth2/v1/userinfo`, { headers: { Authorization: `Bearer ${token}` } });
        if (user.email_verified !== true || !user.email) return false;
        const bases = features.entry?.find((item) => item.name === 'feature:c3_base_urls')?.content || {};
        const tenants = httpsUrl(`https://${bases.tenants_base_url || 'api.preview.cloud.cisco.com'}`);
        const waitlist = httpsUrl(`https://${bases.waitlist_base_url || 'preview.cloud.cisco.com'}`);
        const [tenant, signup] = await Promise.all([
            json(`${tenants.origin}/c3-tenants-service/api/v1/tenantcontext/me`, { headers: { Authorization: `Bearer ${token}` } }),
            json(`${waitlist.origin}/backoffice/api/v1/waitlist/status`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email.replace(/\.[bp][a-z0-9]+(?:\.[a-z0-9]+)+\.splunk\.local$/i, '') }),
            }),
        ]);
        return tenant.tacAccepted === true && signup.status === 'approved';
    }

    async function checkEligibility() {
        const features = await local('web-features?output_mode=json', { app: '-', owner: '-', sharing: 'system' });
        const c3 = features.entry?.find((item) => item.name === 'feature:c3')?.content;
        if (!enabled(c3?.c3_integration_enabled)) return false;
        const query = encode(JSON.stringify({ $and: [{ _key: 'status' }] }));
        const statuses = await local(`storage/collections/data/C3Eligibility?query=${query}`, { app: 'system', owner: currentUser });
        const status = statuses?.[0];
        if (status) return status.isEmailVerified === true && status.isTACSigned === true && status.signupStatus === 'approved';
        return eligibilityFallback(features);
    }

    function isEligible() {
        if (!eligibility || Date.now() - eligibilityAt > CACHE_TIME) {
            eligibilityAt = Date.now();
            eligibility = checkEligibility().catch(() => false);
        }
        return eligibility;
    }

    async function openSession(signal) {
        const [auth, config] = await Promise.all([
            local('ai_canvas_auth?output_mode=json', undefined, { signal }, 'Failed to get AI Canvas access. Contact your Splunk administrator.'),
            endpoint || local('configs/conf-ai-canvas/ai-canvas-endpoints?output_mode=json', { app: 'splunk-ai-canvas' }, { signal }),
        ]);
        const baseUrl = httpsUrl(firstContent(config).ai_canvas_base_url);
        endpoint = Promise.resolve(config);
        if (!auth.access_token) throw new Error('Failed to get AI Canvas access. Contact your Splunk administrator.');
        // Use only Canvas headers for Cisco requests; never forward Splunk cookies or CSRF headers.
        const remote = (path, init = {}, message) => json(`${baseUrl.origin}${baseUrl.pathname.replace(/\/$/, '')}${path}`, {
            ...init, credentials: 'omit', headers: {
                'x-aiassistant-client-product': 'canvas-splunk', Authorization: `Bearer ${auth.access_token}`,
                ...(init.body ? { 'Content-Type': 'application/json' } : {}),
            },
        }, message);
        return {
            async list(offset = 0, requestSignal = signal) {
                const result = await remote(`/api/ai-studio/v2/boards?${new URLSearchParams({ sortBy: 'NAME', orderBy: 'ASC', limit: '50', offset: String(offset) })}`, { signal: requestSignal }, 'Failed to get canvases. Try again.');
                if (!Array.isArray(result.boards) || !Number.isFinite(result.total) || result.total < 0) throw new Error('AI Canvas returned an invalid canvas list.');
                return { boards: result.boards, total: result.total };
            },
            async create(name, description, requestSignal) {
                const result = await remote('/api/ai-studio/v2/boards', { method: 'POST', signal: requestSignal, body: JSON.stringify({ name, description, metadata: {} }) }, 'Failed to create canvas. Check AI Canvas before trying again.');
                if (!result.board?.boardId) throw new Error('AI Canvas did not return the created canvas ID.');
                return result.board.boardId;
            },
            async add(boardId, panel, title, requestSignal) {
                const result = await remote(`/api/ai-studio/v2/boards/${encode(boardId)}/cards`, { method: 'POST', signal: requestSignal, body: JSON.stringify(buildCanvasCard(panel, title)) }, 'Failed to add card. Check AI Canvas before trying again.');
                if (!Array.isArray(result.cardId) || !result.cardId.length) throw new Error('AI Canvas did not return the created card ID.');
                return result.cardId;
            },
        };
    }

    async function preparePanel(dashboardApi, itemDefinition, dataSources, signal) {
        const id = itemDefinition?.dataSources?.primary;
        if (!isCanvasSource(dataSources?.[id])) throw new Error('This panel does not have a supported search.');
        const sid = await panelSearchId(dashboardApi, itemDefinition);
        const controller = panelController(dashboardApi, id);
        const context = controller?.dataSource?.context || controller?.dataSource?.splunkSearch?.context || {};
        const namespace = { app: context.app || currentApp, owner: context.owner || currentUser };
        const job = firstContent(await local(`search/v2/jobs/${encode(sid)}?output_mode=json`, namespace, { signal }, 'Failed to get the panel search job.'));
        let query;
        try { query = dashboardApi.getCompleteSearchQueryAndParameters(id)?.query; } catch { /* Custom sources are resolved below. */ }
        const hasSearchbase = (sourceId, seen = new Set()) => {
            if (!sourceId || seen.has(sourceId)) return false;
            seen.add(sourceId);
            const source = dataSources?.[sourceId];
            return source?.type === 'ds.searchbase' || (source?.type === 'ds.chain' && hasSearchbase(source.options?.extend, seen));
        };
        if (hasSearchbase(id) || !query) query = dataSources[id].type === 'ds.chain'
            ? resolvePanelQuery(dashboardApi, dataSources, id)
            : job.request?.search || job.search || resolvePanelQuery(dashboardApi, dataSources, id);
        if (typeof query !== 'string' || !query.trim() || /\$[\w.]+\$/.test(query)) throw new Error('The panel search has unresolved inputs. Run the panel search and try again.');
        const previewParams = new URLSearchParams({ output_mode: 'json_cols', add_summary_to_metadata: 'true', count: String(CANVAS_PREVIEW_ROWS), offset: '0' });
        if (dataSources[id].type === 'ds.chain') previewParams.set('search', chainPostprocess(dashboardApi, dataSources, id));
        const preview = await local(`search/v2/jobs/${encode(sid)}/results_preview?${previewParams}`, namespace, { signal }, 'Failed to get panel search results.');
        if (!Array.isArray(preview.fields) || !Array.isArray(preview.columns)) throw new Error('The panel search did not return usable results.');
        if (!preview.columns.every(Array.isArray)) throw new Error('The panel search returned invalid result columns.');
        const resultsData = { fields: preview.fields, columns: preview.columns.map((column) => column.slice(0, CANVAS_PREVIEW_ROWS)) };
        if (JSON.stringify(resultsData).length > 5 * 1024 * 1024) throw new Error('The panel preview is too large for AI Canvas. Reduce the panel result size and try again.');
        const earliest = job.request?.earliest_time ?? job.earliestTime ?? '';
        const latest = job.request?.latest_time ?? job.latestTime ?? '';
        const panel = {
            type: itemDefinition.type, sid,
            resultsData,
            searchMetadata: { earliest_time: earliest, latest_time: latest, query: {
                query, earliest_time: earliest, latest_time: latest, sid,
                dispatchState: job.dispatchState, resultsCount: job.resultCount,
            } },
        };
        if (dataSources[id].type === 'ds.savedSearch') {
            const options = dataSources[id].options;
            const saved = (await local(`saved/searches/${encode(options.ref)}?output_mode=json`, { app: options.app || currentApp, owner: '-' }, { signal })).entry?.[0];
            if (!saved?.content || !saved?.acl) throw new Error('Failed to get report details.');
            panel.savedSearch = {
                snapshotTime: earliest ? `${earliest} to ${latest}` : `before ${latest}`,
                alternateLink: saved.links?.alternate || '',
            };
        }
        return panel;
    }

    async function launchUrl(boardId, cardIds, signal) {
        const response = await local('authentication/crosslaunch?target=c3&output_mode=json', undefined, { method: 'POST', signal });
        const redirect = httpsUrl(firstContent(response).redirect_uri);
        const url = new URL(`/home/canvas/boards/${encode(boardId)}`, redirect.origin);
        url.search = redirect.search;
        const prompt = { message: 'Summarize this card that was added from a Splunk dashboard', context: { assistant: { cardIds } } };
        url.searchParams.set('canvas', btoa(JSON.stringify(prompt)));
        return url.href;
    }

    return { isEligible, openSession, preparePanel, launchUrl };
}

export const canvasIntegration = createCanvasIntegration();
export const inspectorUrl = (sid) => createURL(`manager/${encode(app)}/job_inspector`, { sid });
