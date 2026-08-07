import React, { useEffect, useMemo, useState } from 'react';
import {
    SplunkThemeProvider,
    unstable_splunk1cdThemeCustomizer,
    useSplunkTheme,
} from '@splunk/themes';
import {
    APP_THEME_DENSITY,
    APP_THEME_FAMILY,
    readThemePreference,
    resolveThemePreference,
    THEME_CHANGE_EVENT,
    THEME_STORAGE_KEY,
    type ResolvedTheme,
} from './themePreference';

interface AppThemeProviderProps {
    children: React.ReactNode;
    initialColorScheme?: ResolvedTheme;
}

const token = (theme: Record<string, unknown>, name: string, fallback = ''): string => {
    const value = theme[name];
    return typeof value === 'string' ? value : fallback;
};

function ThemeTokenBridge({ children }: { children: React.ReactNode }): JSX.Element {
    const splunkTheme = useSplunkTheme<Record<string, unknown>>();

    const style = useMemo(
        () =>
            ({
                display: 'contents',
                '--sui-background-page': token(splunkTheme, 'backgroundColorPage'),
                '--sui-background-section': token(splunkTheme, 'backgroundColorSection'),
                '--sui-background-navigation': token(splunkTheme, 'backgroundColorNavigation'),
                '--sui-background-popup': token(splunkTheme, 'backgroundColorPopup'),
                '--sui-background-dialog': token(splunkTheme, 'backgroundColorDialog'),
                '--sui-background-floating': token(splunkTheme, 'backgroundColorFloating'),
                '--sui-background-scrim': token(splunkTheme, 'backgroundColorScrim'),
                '--sui-content-active': token(splunkTheme, 'contentColorActive'),
                '--sui-content-default': token(splunkTheme, 'contentColorDefault'),
                '--sui-content-muted': token(splunkTheme, 'contentColorMuted'),
                '--sui-content-disabled': token(splunkTheme, 'contentColorDisabled'),
                '--sui-content-inverted': token(splunkTheme, 'contentColorInverted'),
                '--sui-content-link': token(splunkTheme, 'contentColorLink'),
                '--sui-content-negative': token(splunkTheme, 'contentColorNegative'),
                '--sui-content-positive': token(splunkTheme, 'contentColorPositive'),
                '--sui-content-warning': token(splunkTheme, 'contentColorWarning'),
                '--sui-content-info': token(splunkTheme, 'contentColorInfo'),
                '--sui-border': token(splunkTheme, 'borderColor'),
                '--sui-border-active': token(splunkTheme, 'borderColorActive'),
                '--sui-interactive-accent': token(splunkTheme, 'interactiveColorAccent'),
                '--sui-interactive-border': token(splunkTheme, 'interactiveColorBorder'),
                '--sui-interactive-hover': token(splunkTheme, 'interactiveColorOverlayHover'),
                '--sui-interactive-selected': token(splunkTheme, 'interactiveColorOverlaySelected'),
                '--sui-interactive-active': token(splunkTheme, 'interactiveColorOverlayActive'),
                '--sui-action-primary': token(splunkTheme, 'actionColorBackgroundPrimary'),
                '--sui-action-primary-hover': token(
                    splunkTheme,
                    'actionColorBackgroundPrimaryHover'
                ),
                '--sui-action-secondary': token(splunkTheme, 'actionColorBackgroundSecondary'),
                '--sui-action-subtle': token(splunkTheme, 'actionColorBackgroundSubtle'),
                '--sui-action-destructive': token(
                    splunkTheme,
                    'actionColorBackgroundDestructive'
                ),
                '--sui-focus-color': token(splunkTheme, 'focusColor'),
                '--sui-focus-shadow': token(splunkTheme, 'focusShadow'),
                '--sui-font-family': token(splunkTheme, 'fontFamily'),
                '--sui-font-family-title': token(splunkTheme, 'fontFamilyTitle'),
                '--sui-font-family-mono': token(splunkTheme, 'monoFontFamily'),
                '--sui-font-size-small': token(splunkTheme, 'fontSizeSmall', '12px'),
                '--sui-font-size-default': token(splunkTheme, 'fontSize', '14px'),
                '--sui-font-size-large': token(splunkTheme, 'fontSizeLarge', '16px'),
                '--sui-spacing-xsmall': token(splunkTheme, 'spacingXSmall', '4px'),
                '--sui-spacing-small': token(splunkTheme, 'spacingSmall', '8px'),
                '--sui-spacing-medium': token(splunkTheme, 'spacingMedium', '12px'),
                '--sui-spacing-large': token(splunkTheme, 'spacingLarge', '16px'),
                '--sui-spacing-xlarge': token(splunkTheme, 'spacingXLarge', '24px'),
                '--sui-border-radius': token(splunkTheme, 'borderRadius', '4px'),
                '--sui-input-height': token(splunkTheme, 'inputHeight', '32px'),
            }) as React.CSSProperties,
        [splunkTheme]
    );

    return <div style={style}>{children}</div>;
}

export default function AppThemeProvider({
    children,
    initialColorScheme = 'light',
}: AppThemeProviderProps): JSX.Element {
    const [colorScheme, setColorScheme] = useState<ResolvedTheme>(initialColorScheme);

    useEffect(() => {
        let active = true;

        const refresh = async () => {
            const next = await resolveThemePreference();
            if (active) setColorScheme(next);
        };
        const handleStorage = (event: StorageEvent) => {
            if (event.key === THEME_STORAGE_KEY) void refresh();
        };

        void refresh();
        window.addEventListener(THEME_CHANGE_EVENT, refresh);
        window.addEventListener('storage', handleStorage);

        return () => {
            active = false;
            window.removeEventListener(THEME_CHANGE_EVENT, refresh);
            window.removeEventListener('storage', handleStorage);
        };
    }, []);

    return (
        <SplunkThemeProvider
            family={APP_THEME_FAMILY}
            colorScheme={colorScheme}
            density={APP_THEME_DENSITY}
            customizeTheme={unstable_splunk1cdThemeCustomizer}
        >
            <ThemeTokenBridge>{children}</ThemeTokenBridge>
        </SplunkThemeProvider>
    );
}
