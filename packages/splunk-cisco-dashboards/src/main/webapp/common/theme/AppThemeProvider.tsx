import React from 'react';
import {
    SplunkThemeProvider,
    unstable_splunk1cdThemeCustomizer,
} from '@splunk/themes';
import SemanticThemeStyles from './SemanticThemeStyles';

interface AppThemeProviderProps {
    children: React.ReactNode;
}

/**
 * The single application theme boundary.
 *
 * The app intentionally ships in Prisma/1CD dark mode for now. Keeping the
 * color scheme here means every SUI component, portal, and product-owned
 * styled-component consumes the same theme instead of coordinating separate
 * page, browser-preference, Tailwind, and shell theme state.
 */
export default function AppThemeProvider({ children }: AppThemeProviderProps): JSX.Element {
    return (
        <SplunkThemeProvider
            family="prisma"
            colorScheme="dark"
            density="comfortable"
            customizeTheme={unstable_splunk1cdThemeCustomizer}
        >
            <SemanticThemeStyles />
            {children}
        </SplunkThemeProvider>
    );
}
