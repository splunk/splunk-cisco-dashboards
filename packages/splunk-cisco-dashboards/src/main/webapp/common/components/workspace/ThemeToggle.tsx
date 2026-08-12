/**
 * ThemeToggle — clearly-labeled pill button that cycles
 *   light → dark → system → light …
 *
 * We show both an icon AND a text label so the control is impossible
 * to overlook in the dashboard header. The label always reflects the
 * user's *preference* (not the resolved theme), so "AUTO" stays
 * visible when following the Splunk user theme.
 */

import React from 'react';
import Button from '@splunk/react-ui/Button';
import Sun from '@splunk/react-icons/Sun';
import Moon from '@splunk/react-icons/Moon';
import MonitorPhone from '@splunk/react-icons/MonitorPhone';
import type { ThemePreference } from '@/common/hooks/useTheme';

interface ThemeToggleProps {
    theme: ThemePreference;
    onCycle: () => void;
    className?: string;
    iconOnly?: boolean;
}

const PRESET: Record<
    ThemePreference,
    {
        label: string;
        nextLabel: string;
        Icon: React.ComponentType<{ width?: number; height?: number; 'aria-hidden'?: boolean }>;
    }
> = {
    light: {
        label: 'LIGHT',
        nextLabel: 'Switch to dark mode',
        Icon: Sun,
    },
    dark: {
        label: 'DARK',
        nextLabel: 'Switch to follow Splunk theme',
        Icon: Moon,
    },
    system: {
        label: 'AUTO',
        nextLabel: 'Switch to light mode',
        Icon: MonitorPhone,
    },
};

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
    theme,
    onCycle,
    className,
    iconOnly = false,
}) => {
    const preset = PRESET[theme];
    const Icon = preset.Icon;
    return (
        <Button
            appearance="subtle"
            onClick={onCycle}
            title={preset.nextLabel}
            aria-label={preset.nextLabel}
            className={className}
            icon={<Icon width={iconOnly ? 20 : 16} height={iconOnly ? 20 : 16} aria-hidden />}
            label={iconOnly ? undefined : preset.label}
        />
    );
};
