import { getDefaultFetchInit } from '@splunk/splunk-utils/fetch';
import { INSIGHTS_APP_ID } from './constants';

const jsonParams = new URLSearchParams({ output_mode: 'json' });
const jsonCountParams = new URLSearchParams({ output_mode: 'json', count: '0' });

const requestJson = async (url, init = {}) => {
    const response = await fetch(url, {
        ...getDefaultFetchInit(),
        ...init,
        headers: {
            ...(getDefaultFetchInit().headers || {}),
            ...(init.headers || {}),
        },
    });
    const data = await response.json();
    data.status = response.status;
    return data;
};

const dashboardUrl = (dashboardId = '') =>
    `/en-US/splunkd/__raw/servicesNS/nobody/${encodeURIComponent(
        INSIGHTS_APP_ID,
    )}/data/ui/views${dashboardId ? `/${encodeURIComponent(dashboardId)}` : ''}`;

export async function getDashboards() {
    return requestJson(`${dashboardUrl()}?${jsonCountParams.toString()}`, {
        method: 'GET',
    });
}

export async function getDashboard(dashboardID) {
    return requestJson(`${dashboardUrl(dashboardID)}?${jsonParams.toString()}`, {
        method: 'GET',
    });
}

const escapeXml = (value = '') =>
    String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

export async function addDash(
    dashName,
    jsonDefinition,
    dashLabel = undefined,
    dashDescription = '',
    dashTag = '',
) {
    const definition = `<dashboard version="2" theme="light">
   <label>${escapeXml(dashLabel || dashName)}</label>
   <description>${escapeXml(dashDescription)}</description>
   <definition><![CDATA[${jsonDefinition}]]></definition>
   <tag>${escapeXml(dashTag)}</tag>
   <meta type="hiddenElements"><![CDATA[
        {
        "hideEdit": true,
        "hideOpenInSearch": false,
        "hideExport": false
        }
   ]]></meta>
</dashboard>`;

    const createBody = new URLSearchParams({
        name: dashName,
        'eai:data': definition,
    });

    const response = await requestJson(`${dashboardUrl()}?${jsonParams.toString()}`, {
        method: 'POST',
        body: createBody.toString(),
    });

    if (response.status !== 409) {
        return response;
    }

    return requestJson(`${dashboardUrl(dashName)}?${jsonParams.toString()}`, {
        method: 'POST',
        body: new URLSearchParams({ 'eai:data': definition }).toString(),
    });
}

export async function syncDashboardManagerNavigation(dashboards = []) {
    // Dashboard Manager used to POST a complete nav XML payload to data/ui/nav/default
    // so the "My Views" menu stayed current. Splunk persists that as local/default.xml,
    // which shadows the app's packaged nav and makes future nav changes look "localized".
    // Keep the public helper as a successful no-op so existing dashboard flows stay intact.
    return { status: 204, entry: [], dashboards };
}

export async function updateDashMetadata(
    dashName,
    dashboardDefinition,
    dashLabel,
    dashDescription = '',
    dashTag = '',
) {
    const updatedDefinition = {
        ...dashboardDefinition,
        title: dashLabel,
        description: dashDescription,
        tag: dashTag,
    };

    return addDash(
        dashName,
        JSON.stringify(updatedDefinition),
        dashLabel,
        dashDescription,
        dashTag,
    );
}

const normalizeDeleteTarget = (target) => {
    if (!target) return undefined;
    if (/^https?:\/\//i.test(target)) {
        const url = new URL(target);
        return `${url.pathname}${url.search}`;
    }
    if (target.startsWith('/en-US/splunkd/__raw')) {
        return target.includes('?') ? target : `${target}?${jsonParams.toString()}`;
    }
    if (target.startsWith('/services') || target.startsWith('/servicesNS')) {
        const rawTarget = `/en-US/splunkd/__raw${target}`;
        return rawTarget.includes('?') ? rawTarget : `${rawTarget}?${jsonParams.toString()}`;
    }
    return target;
};

export async function deleteDashboard(
    dashName,
    app = INSIGHTS_APP_ID,
    owner = 'nobody',
    sharing = 'app',
    deleteLink,
) {
    const targets = [];
    const normalizedDeleteLink = normalizeDeleteTarget(deleteLink);
    if (normalizedDeleteLink) targets.push(normalizedDeleteLink);

    const namespaceOwners =
        sharing === 'user' ? [owner] : Array.from(new Set([owner, 'nobody'].filter(Boolean)));
    namespaceOwners.forEach((namespaceOwner) => {
        targets.push(
            `/en-US/splunkd/__raw/servicesNS/${encodeURIComponent(
                namespaceOwner,
            )}/${encodeURIComponent(app)}/data/ui/views/${encodeURIComponent(
                dashName,
            )}?${jsonParams.toString()}`,
        );
    });
    targets.push(
        `/en-US/splunkd/__raw/servicesNS/-/${encodeURIComponent(
            app,
        )}/data/ui/views/${encodeURIComponent(dashName)}?${jsonParams.toString()}`,
    );

    let lastResponse;
    for (const target of Array.from(new Set(targets))) {
        const data = await requestJson(target, { method: 'DELETE' });
        if (data.status !== 404) return data;
        lastResponse = data;
    }

    return lastResponse;
}

export async function getServerInfo() {
    return requestJson(
        `/en-US/splunkd/__raw/services/server/info?${jsonCountParams.toString()}`,
        {
            method: 'GET',
        },
    );
}

export async function getBackgrounds() {
    return requestJson(
        `/en-US/splunkd/__raw/servicesNS/nobody/${encodeURIComponent(
            INSIGHTS_APP_ID,
        )}/configs/conf-templates?${jsonParams.toString()}`,
        {
            method: 'GET',
        },
    ).catch(() => ({ status: 404, entry: [] }));
}

export async function addBackgrounds(image) {
    const name = `background://bg_${Date.now()}`;
    const body = new URLSearchParams({
        name,
        data: image,
    });

    return requestJson(
        `/en-US/splunkd/__raw/servicesNS/nobody/${encodeURIComponent(
            INSIGHTS_APP_ID,
        )}/configs/conf-templates?${jsonParams.toString()}`,
        {
            method: 'POST',
            body: body.toString(),
        },
    );
}

export async function isAppInstalled(appId) {
    const data = await requestJson(
        `/en-US/splunkd/__raw/services/apps/local/${encodeURIComponent(
            appId,
        )}?${jsonParams.toString()}`,
        { method: 'GET' },
    ).catch(() => ({ status: 404 }));
    return data.status >= 200 && data.status < 300 ? data.entry?.[0] || true : false;
}

export function isVersionLower(current, target) {
    const currentParts = String(current || '').split('.').map(Number);
    const targetParts = String(target || '').split('.').map(Number);
    const length = Math.max(currentParts.length, targetParts.length);

    for (let i = 0; i < length; i += 1) {
        const c = currentParts[i] || 0;
        const t = targetParts[i] || 0;
        if (c < t) return true;
        if (c > t) return false;
    }

    return false;
}
