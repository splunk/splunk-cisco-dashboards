import type { ResolvedTheme } from './themePreference';

export const SPLUNK_SHELL_THEME_ATTRIBUTE = 'data-scd-shell-theme';

/**
 * Make Splunk's surrounding navigation follow the dashboard's effective mode.
 *
 * Simple XML chooses its chrome theme before the React dashboard mounts, so a
 * dashboard-level theme toggle cannot update that provider directly. Publishing
 * the resolved mode on the document root lets the shared, narrowly scoped shell
 * stylesheet bridge that gap without reloading the page or losing unsaved work.
 */
export const syncSplunkShellTheme = (theme: ResolvedTheme): (() => void) => {
    if (typeof document === 'undefined') {
        return () => undefined;
    }

    const previousTheme = document.documentElement.getAttribute(
        SPLUNK_SHELL_THEME_ATTRIBUTE
    );
    document.documentElement.setAttribute(SPLUNK_SHELL_THEME_ATTRIBUTE, theme);

    return () => {
        if (
            document.documentElement.getAttribute(SPLUNK_SHELL_THEME_ATTRIBUTE) !== theme
        ) {
            return;
        }
        if (previousTheme) {
            document.documentElement.setAttribute(
                SPLUNK_SHELL_THEME_ATTRIBUTE,
                previousTheme
            );
        } else {
            document.documentElement.removeAttribute(SPLUNK_SHELL_THEME_ATTRIBUTE);
        }
    };
};
