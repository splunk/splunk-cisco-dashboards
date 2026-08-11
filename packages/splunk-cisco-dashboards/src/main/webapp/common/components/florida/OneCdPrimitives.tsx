import React from 'react';
import Card from '@splunk/react-ui/Card';
import RadioBar from '@splunk/react-ui/RadioBar';
import { variables } from '@splunk/themes';
import styled from 'styled-components';

/** Released SUI glass material for non-nested, high-emphasis overlays. */
export const OneCdGlassCard = styled(Card).attrs({ material: 'glass' as const })`
    position: relative;
    z-index: 1;
    border-radius: ${variables.borderRadius};
`;

export interface OneCdRadioOption<T extends string = string> {
    label: string;
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
    position: relative;
    z-index: 1;

    && [role='radio'] {
        min-width: 56px;
        justify-content: center;
    }

    && [role='radio'][aria-checked='true'] {
        background-color: ${variables.interactiveColorPrimary} !important;
        color: ${variables.contentColorInverted} !important;
        font-weight: 700;
        box-shadow:
            inset 0 0 0 1px ${variables.focusColor},
            0 0 12px ${variables.accentColor};
    }

    && [role='radio'][aria-checked='true'] * {
        color: inherit !important;
    }
`;

/** A controlled SUI RadioBar used for a small set of related surface views. */
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
            value={value}
            onChange={(_event, data) => onChange(data.value as T)}
        >
            {options.map((option) => (
                <RadioBar.Option
                    key={option.value}
                    label={option.label}
                    value={option.value}
                />
            ))}
        </StyledRadioBar>
    );
}
