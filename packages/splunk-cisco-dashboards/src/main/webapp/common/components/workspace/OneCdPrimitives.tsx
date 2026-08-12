import React from 'react';
import Card from '@splunk/react-ui/Card';
import RadioBar from '@splunk/react-ui/RadioBar';
import styled from 'styled-components';

/** SUI 5.13 glass material for non-nested, high-emphasis overlays. */
export const OneCdGlassCard = styled(Card).attrs({ material: 'glass' as const })`
    position: relative;
    z-index: 1;
`;

export interface OneCdRadioOption<T extends string = string> {
    label?: string;
    ariaLabel?: string;
    startAdornment?: React.ReactNode;
    value: T;
}

interface OneCdRadioBarProps<T extends string = string> {
    ariaLabel: string;
    options: readonly OneCdRadioOption<T>[];
    value: T;
    onChange: (value: T) => void;
    className?: string;
}

const StyledRadioBar = styled(RadioBar)`
    && [role='menuitemradio'] {
        opacity: 0.82;
    }

    && [role='menuitemradio'][aria-checked='true'],
    && [role='menuitemradio']:focus-visible {
        opacity: 1;
    }
`;

/** A controlled SUI RadioBar with a subtle emphasis for the selected or focused option. */
export function OneCdRadioBar<T extends string>({
    ariaLabel,
    options,
    value,
    onChange,
    className,
}: OneCdRadioBarProps<T>): JSX.Element {
    return (
        <StyledRadioBar
            aria-label={ariaLabel}
            className={className}
            inline
            role="menubar"
            value={value}
            onChange={(_event, data) => onChange(data.value as T)}
        >
            {options.map((option) => (
                <RadioBar.Option
                    key={option.value}
                    aria-label={option.ariaLabel || option.label}
                    label={option.label}
                    startAdornment={option.startAdornment}
                    value={option.value}
                />
            ))}
        </StyledRadioBar>
    );
}
