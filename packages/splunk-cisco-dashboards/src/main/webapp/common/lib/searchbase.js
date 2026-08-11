import { getDefaultFetchInit } from '@splunk/splunk-utils/fetch';
import { INSIGHTS_APP_ID } from './constants';

const JSON_PARAMS = new URLSearchParams({
    output_mode: 'json',
    count: '0',
});
const APP_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;

const withStatus = async (response) => {
    const data = await response.json();
    data.status = response.status;
    return data;
};

const resolveOwnerApp = (ownerApp) =>
    typeof ownerApp === 'string' && APP_NAME_PATTERN.test(ownerApp)
        ? ownerApp
        : INSIGHTS_APP_ID;

export async function getSearchBaseConfStanza(stanza, ownerApp = INSIGHTS_APP_ID) {
    const resolvedOwnerApp = resolveOwnerApp(ownerApp);
    const response = await fetch(
        `/en-US/splunkd/__raw/servicesNS/-/${encodeURIComponent(
            resolvedOwnerApp,
        )}/configs/conf-searchbase/${encodeURIComponent(stanza)}?${JSON_PARAMS.toString()}`,
        {
            ...getDefaultFetchInit(),
            method: 'GET',
        },
    );

    return withStatus(response);
}

export async function getSearches(ownerApp = INSIGHTS_APP_ID) {
    const resolvedOwnerApp = resolveOwnerApp(ownerApp);
    const appSearchParams = new URLSearchParams({
        output_mode: 'json',
        count: '0',
        search: `eai:acl.app=${resolvedOwnerApp}`,
    });
    const response = await fetch(
        `/en-US/splunkd/__raw/servicesNS/-/-/configs/conf-searchbase?${appSearchParams.toString()}`,
        {
            ...getDefaultFetchInit(),
            method: 'GET',
        },
    );

    const data = await withStatus(response);
    data.entry = (data.entry || []).filter((entry) => entry.acl?.app === resolvedOwnerApp);
    return data;
}

export async function getDisplaySearchesList(searchID) {
    const data = await getSearches();
    data.display_searches = (data.entry || []).filter((search) =>
        search.content?.diagnostic_searches
            ?.split(',')
            .map((value) => value.trim())
            .includes(searchID),
    );
    return data;
}

export async function isSearchBaseInstalled() {
    return true;
}

export async function isUsecaseExplorerInstalled() {
    return false;
}
