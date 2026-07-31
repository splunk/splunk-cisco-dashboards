/**
 * Shared Simple XML bootstrap for the Executive Insights React experience.
 *
 * Both executive_briefing_profile.xml and secure_networking_profile.xml load
 * this file and provide the same #scan-root mount for their selected profile.
 * Keeping this outside appserver/templates makes a first install immediately
 * usable without requiring Splunk Web to restart its Mako template loader.
 */
var SCD_EXECUTIVE_INSIGHTS_APP_NAME = 'splunk-cisco-dashboards';
var SCD_EXECUTIVE_INSIGHTS_UPDATE_HOST_SELECTOR =
    '[data-scd-app-update-host]';
var SCD_EXECUTIVE_INSIGHTS_VERSION_PATTERN =
    /^v?(\d+(?:\.\d+)*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function scdNormalizeAppVersion(value) {
    return String(value || '').trim();
}

function scdParseAppVersion(value) {
    var normalized = scdNormalizeAppVersion(value);
    var match = normalized.match(SCD_EXECUTIVE_INSIGHTS_VERSION_PATTERN);
    if (!match) return null;

    return {
        core: match[1].split('.').map(Number),
        prerelease: match[2] ? match[2].split('.') : [],
    };
}

function scdComparePrerelease(left, right) {
    if (!left.length && !right.length) return 0;
    if (!left.length) return 1;
    if (!right.length) return -1;

    var length = Math.max(left.length, right.length);
    for (var index = 0; index < length; index += 1) {
        var leftPart = left[index];
        var rightPart = right[index];

        if (leftPart === undefined) return -1;
        if (rightPart === undefined) return 1;
        if (leftPart === rightPart) continue;

        var leftIsNumeric = /^\d+$/.test(leftPart);
        var rightIsNumeric = /^\d+$/.test(rightPart);
        if (leftIsNumeric && rightIsNumeric) {
            return Number(leftPart) > Number(rightPart) ? 1 : -1;
        }
        if (leftIsNumeric) return -1;
        if (rightIsNumeric) return 1;
        return leftPart > rightPart ? 1 : -1;
    }

    return 0;
}

function scdCompareAppVersions(left, right) {
    var leftVersion = scdParseAppVersion(left);
    var rightVersion = scdParseAppVersion(right);
    if (!leftVersion || !rightVersion) return null;

    var length = Math.max(
        leftVersion.core.length,
        rightVersion.core.length
    );
    for (var index = 0; index < length; index += 1) {
        var leftPart = leftVersion.core[index] || 0;
        var rightPart = rightVersion.core[index] || 0;
        if (leftPart > rightPart) return 1;
        if (leftPart < rightPart) return -1;
    }

    return scdComparePrerelease(
        leftVersion.prerelease,
        rightVersion.prerelease
    );
}

/**
 * Splunk's update.version is the latest Splunkbase version it knows
 * about. Fail closed unless that candidate is provably newer than the
 * installed version.
 */
function scdResolveAppVersions(installedVersion, updateVersion) {
    var installed = scdNormalizeAppVersion(installedVersion);
    var candidate = scdNormalizeAppVersion(updateVersion);
    var comparison = installed
        ? scdCompareAppVersions(candidate, installed)
        : null;

    return {
        version: installed,
        updateVersion:
            comparison !== null && comparison > 0 ? candidate : '',
    };
}

function scdLocalePrefix(pathname) {
    var match = String(pathname || '').match(
        /^\/([a-z]{2}-[A-Z]{2})(?:\/|$)/
    );
    return '/' + (match ? match[1] : 'en-US');
}

function scdInstallUpdateBadgeStyles() {
    if (document.getElementById('scd-executive-insights-update-badge-styles')) {
        return;
    }

    var style = document.createElement('style');
    style.id = 'scd-executive-insights-update-badge-styles';
    style.textContent =
        '.scd-shell-update-badge{' +
        'display:inline-flex!important;align-items:center!important;' +
        'justify-content:center!important;gap:5px!important;' +
        'height:30px!important;min-height:30px!important;' +
        'padding:0 12px!important;border:1px solid #d97706!important;' +
        'border-radius:5px!important;background:linear-gradient(135deg,#f59e0b,#d97706)!important;' +
        'color:#fff!important;box-shadow:0 1px 4px rgba(245,158,11,.28)!important;' +
        'font-size:12px!important;font-weight:700!important;line-height:1!important;' +
        'white-space:nowrap!important;text-decoration:none!important;' +
        'animation:scdUpdatePulse 2s ease-in-out infinite;' +
        'transition:background .15s,border-color .15s,box-shadow .15s,opacity .15s}' +
        '.scd-shell-update-badge:hover{' +
        'background:linear-gradient(135deg,#d97706,#b45309)!important;' +
        'border-color:#b45309!important;color:#fff!important;' +
        'box-shadow:0 2px 8px rgba(180,83,9,.38)!important;' +
        'text-decoration:none!important}' +
        '.scd-shell-update-badge:focus-visible{' +
        'outline:2px solid #38bdf8!important;outline-offset:2px!important}' +
        '@keyframes scdUpdatePulse{0%,100%{opacity:1}50%{opacity:.76}}' +
        '@media (prefers-reduced-motion:reduce){' +
        '.scd-shell-update-badge{animation:none!important}}';
    document.head.appendChild(style);
}

function scdRenderUpdateBadge(appVersions) {
    var host = document.querySelector(
        SCD_EXECUTIVE_INSIGHTS_UPDATE_HOST_SELECTOR
    );
    if (!host) return false;

    var existing = host.querySelector('.scd-shell-update-badge');
    if (!appVersions.updateVersion) {
        if (existing) existing.remove();
        return true;
    }

    var locale = scdLocalePrefix(window.location.pathname);
    var badge = existing || document.createElement('a');
    var installedLabel = appVersions.version
        ? 'v' + appVersions.version
        : 'the installed version';
    var title =
        'Upgrade from ' +
        installedLabel +
        ' to v' +
        appVersions.updateVersion +
        ' — click to update';

    badge.className = 'scd-shell-update-badge';
    badge.href =
        locale +
        '/manager/appinstall/' +
        encodeURIComponent(SCD_EXECUTIVE_INSIGHTS_APP_NAME);
    badge.target = '_blank';
    badge.rel = 'noopener noreferrer';
    badge.title = title;
    badge.setAttribute(
        'aria-label',
        'Update available: v' +
            appVersions.updateVersion +
            '. Open Manage Apps to upgrade'
    );
    badge.textContent = '\u2b06 v' + appVersions.updateVersion;

    if (!existing) host.appendChild(badge);
    return true;
}

function scdMountUpdateBadgeWhenReady(appVersions) {
    if (!appVersions.updateVersion || scdRenderUpdateBadge(appVersions)) {
        return;
    }

    var observer = new MutationObserver(function () {
        if (scdRenderUpdateBadge(appVersions)) observer.disconnect();
    });
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
    });
}

function scdLoadUpdateBadge() {
    var locale = scdLocalePrefix(window.location.pathname);
    var endpoint =
        locale +
        '/splunkd/__raw/services/apps/local/' +
        encodeURIComponent(SCD_EXECUTIVE_INSIGHTS_APP_NAME) +
        '?output_mode=json';

    fetch(endpoint, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    })
        .then(function (response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
        })
        .then(function (payload) {
            var entry = payload.entry && payload.entry[0];
            var content = (entry && entry.content) || {};
            scdMountUpdateBadgeWhenReady(
                scdResolveAppVersions(
                    content.version,
                    content['update.version']
                )
            );
        })
        .catch(function () {
            // App metadata is optional shell chrome; leave the badge hidden.
        });
}

function scdLoadExecutiveInsightsBundle() {
    if (document.querySelector('script[data-scd-executive-insights-bundle]')) {
        return;
    }

    /*
     * Splunk serves app static assets with long-lived cache headers. Keep
     * the React bundle request cache-busted so iterative dashboard changes
     * do not leave browsers running a stale bundle.
     */
    var scdAssetVersion = Date.now();
    var scdExecutiveInsightsScript = document.createElement('script');
    scdExecutiveInsightsScript.setAttribute(
        'data-scd-executive-insights-bundle',
        'true'
    );
    scdExecutiveInsightsScript.src =
        '/static/app/splunk-cisco-dashboards/pages/executive_insights.js?v=' +
        scdAssetVersion;
    document.body.appendChild(scdExecutiveInsightsScript);
}

function scdLoadExecutiveInsightsWhenConfigured() {
    // Simple XML loads application.js before its view script, so the normal
    // path waits for the app-wide first-run gate. Fail open if a nonstandard
    // shell omitted the gate, matching application.js's endpoint-failure
    // behavior and avoiding a blank dashboard.
    var setupGate = window.scdSetupGatePromise;
    Promise.resolve(setupGate).then(function (canLoadApp) {
        if (canLoadApp !== false) scdLoadExecutiveInsightsBundle();
    });
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    scdInstallUpdateBadgeStyles();
    scdLoadUpdateBadge();
    scdLoadExecutiveInsightsWhenConfigured();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        compareAppVersions: scdCompareAppVersions,
        resolveAppVersions: scdResolveAppVersions,
        localePrefix: scdLocalePrefix,
    };
}
