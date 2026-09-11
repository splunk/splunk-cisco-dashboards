const APP_NAME = 'splunk-cisco-dashboards';

export const splunkLocalePrefix = (pathname?: string): string => {
    const resolvedPathname =
        pathname ??
        (typeof window !== 'undefined' ? window.location.pathname : '/en-US');
    const match = String(resolvedPathname).match(
        /^\/([a-z]{2}-[A-Z]{2})(?:\/|$)/
    );
    return `/${match ? match[1] : 'en-US'}`;
};

export const appStaticAssetUrl = (
    relativePath: string,
    pathname?: string
): string => {
    const normalizedPath = String(relativePath || '').replace(/^\/+/, '');
    return `${splunkLocalePrefix(pathname)}/static/app/${APP_NAME}/${normalizedPath}`;
};
