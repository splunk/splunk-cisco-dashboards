import React from 'react';
import Card from '@splunk/react-ui/Card';
import RadioBar from '@splunk/react-ui/RadioBar';
import SpotLight, { type SpotLightIntensity } from '@splunk/react-ui/SpotLight';
import { variables } from '@splunk/themes';
import styled from 'styled-components';

type SpotLightVariant = React.ComponentProps<typeof SpotLight>['variant'];
type SpotLightInset = React.ComponentProps<typeof SpotLight>['inset'];
type SpotLightScale = React.ComponentProps<typeof SpotLight>['scale'];

interface OneCdSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
    as?: 'div' | 'section';
    /**
     * Adds the released SUI 1CD spotlight treatment behind this surface.
     * `false` keeps the layout wrapper without rendering a glow.
     */
    spotlight?: SpotLightVariant | false;
    spotlightIntensity?: SpotLightIntensity;
    spotlightInset?: SpotLightInset;
    spotlightScale?: SpotLightScale;
    contentClassName?: string;
}

const StyledSurface = styled.div`
    position: relative;
    isolation: isolate;
    color: ${variables.contentColorDefault};
`;

const StyledSpotLight = styled(SpotLight)`
    z-index: 0;
    pointer-events: none;
`;

const StyledSurfaceContent = styled.div`
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: inherit;
`;

/**
 * Shared 1CD atmosphere wrapper. It deliberately owns only layering and the
 * SUI SpotLight; each consumer continues to own its layout and interactions.
 */
export const OneCdSurface: React.FC<OneCdSurfaceProps> = ({
    as = 'div',
    spotlight = false,
    spotlightIntensity = 'low',
    spotlightInset,
    spotlightScale,
    contentClassName,
    children,
    ...surfaceProps
}) => (
    <StyledSurface as={as} {...surfaceProps}>
        {spotlight && (
            <StyledSpotLight
                aria-hidden="true"
                variant={spotlight}
                intensity={spotlightIntensity}
                inset={spotlightInset}
                scale={spotlightScale}
            />
        )}
        <StyledSurfaceContent className={contentClassName}>
            {children}
        </StyledSurfaceContent>
    </StyledSurface>
);

/**
 * Released SUI glass material for non-nested, high-emphasis overlays. Keeping
 * it here prevents local backdrop-filter and translucent-color lookalikes.
 */
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
