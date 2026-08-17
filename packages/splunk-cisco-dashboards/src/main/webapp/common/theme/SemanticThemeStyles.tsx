import {
  createGlobalStyle,
  css,
  type FlattenSimpleInterpolation,
} from "styled-components";
import { mixins, variables } from "@splunk/themes";
import type { ComponentType } from "react";

// FILE NOTE: This is merely a step towards ripping out tailwind - ultimately this file should not be necessary and styledcomponents use the tokens directly as needed (which should be a lot less common once most things are using native SUI components).

type HeadingTypographyVariant =
  | "title1"
  | "title2"
  | "title3"
  | "title4"
  | "title5"
  | "title6";

// Bridge the styled-components theme types bundled separately by SUI and this app.
const headingTypography = mixins.typography as unknown as (
  variant: HeadingTypographyVariant,
) => FlattenSimpleInterpolation;

const stateStyles = css`
  .sui-color-active,
  .sui-hover-color-active:hover,
  .sui-focus-color-active:focus,
  .sui-focus-visible-color-active:focus-visible,
  .group:hover .sui-group-hover-color-active,
  [class*="group/"]:hover .sui-group-hover-color-active {
    color: ${variables.contentColorActive};
  }

  .sui-color-default,
  .sui-hover-color-default:hover,
  .sui-focus-color-default:focus,
  .sui-focus-visible-color-default:focus-visible,
  .group:hover .sui-group-hover-color-default,
  [class*="group/"]:hover .sui-group-hover-color-default {
    color: ${variables.contentColorDefault};
  }

  .sui-color-muted,
  .sui-hover-color-muted:hover,
  .sui-focus-color-muted:focus,
  .sui-focus-visible-color-muted:focus-visible,
  .group:hover .sui-group-hover-color-muted,
  [class*="group/"]:hover .sui-group-hover-color-muted {
    color: ${variables.contentColorMuted};
  }

  .sui-color-disabled,
  .sui-disabled-color:disabled,
  .sui-disabled-color[aria-disabled="true"] {
    color: ${variables.contentColorDisabled};
  }

  .sui-color-inverted,
  .sui-hover-color-inverted:hover,
  .sui-focus-color-inverted:focus,
  .sui-focus-visible-color-inverted:focus-visible {
    color: ${variables.contentColorInverted};
  }

  .sui-color-link,
  .sui-hover-color-link:hover,
  .sui-focus-color-link:focus,
  .sui-focus-visible-color-link:focus-visible,
  .group:hover .sui-group-hover-color-link,
  [class*="group/"]:hover .sui-group-hover-color-link {
    color: ${variables.contentColorLink};
  }

  .sui-color-info,
  .sui-hover-color-info:hover,
  .sui-focus-color-info:focus,
  .sui-focus-visible-color-info:focus-visible,
  .group:hover .sui-group-hover-color-info,
  [class*="group/"]:hover .sui-group-hover-color-info {
    color: ${variables.contentColorInfo};
  }

  .sui-color-positive,
  .sui-hover-color-positive:hover,
  .sui-focus-color-positive:focus,
  .sui-focus-visible-color-positive:focus-visible,
  .group:hover .sui-group-hover-color-positive,
  [class*="group/"]:hover .sui-group-hover-color-positive {
    color: ${variables.contentColorPositive};
  }

  .sui-color-warning,
  .sui-hover-color-warning:hover,
  .sui-focus-color-warning:focus,
  .sui-focus-visible-color-warning:focus-visible,
  .group:hover .sui-group-hover-color-warning,
  [class*="group/"]:hover .sui-group-hover-color-warning {
    color: ${variables.contentColorWarning};
  }

  .sui-color-negative,
  .sui-hover-color-negative:hover,
  .sui-focus-color-negative:focus,
  .sui-focus-visible-color-negative:focus-visible,
  .group:hover .sui-group-hover-color-negative,
  [class*="group/"]:hover .sui-group-hover-color-negative {
    color: ${variables.contentColorNegative};
  }

`;

const backgroundStyles = css`
  .sui-bg-page {
    background-color: ${variables.backgroundColorPage};
  }
  .sui-bg-section {
    background-color: ${variables.backgroundColorSection};
  }
  .sui-bg-popup {
    background-color: ${variables.backgroundColorPopup};
  }
  .sui-bg-floating {
    background-color: ${variables.backgroundColorFloating};
  }
  .sui-bg-transparent {
    background-color: transparent;
  }
  .sui-bg-interactive {
    background-color: ${variables.interactiveColorBackground};
  }
  .sui-bg-selected,
  .sui-hover-bg-selected:hover,
  .sui-focus-bg-selected:focus,
  .sui-focus-visible-bg-selected:focus-visible,
  .group:hover .sui-group-hover-bg-selected {
    background-color: ${variables.interactiveColorOverlaySelected};
  }
  .sui-bg-overlay,
  .sui-hover-bg-overlay:hover,
  .sui-focus-bg-overlay:focus,
  .sui-focus-visible-bg-overlay:focus-visible,
  .group:hover .sui-group-hover-bg-overlay {
    background-color: ${variables.interactiveColorOverlayHover};
  }
  .sui-active-bg-overlay:active {
    background-color: ${variables.interactiveColorOverlayActive};
  }
  .sui-bg-border-strong {
    background-color: ${variables.borderColorStrong};
  }
  .sui-bg-info {
    background-color: ${variables.statusColorInfoWeak};
  }
  .sui-bg-positive {
    background-color: ${variables.statusColorNormalWeak};
  }
  .sui-bg-warning {
    background-color: ${variables.statusColorMediumWeak};
  }
  .sui-bg-negative {
    background-color: ${variables.statusColorCriticalWeak};
  }

  /*
   * Semantic fills have two deliberately separate roles. Notification
   * surfaces hold text and therefore use the subdued SUI notification
   * palette. Status fills are reserved for compact signals such as dots,
   * markers, and progress values where a solid color is required.
   */
  .sui-bg-notification-info,
  .sui-hover-bg-notification-info:hover {
    background-color: ${variables.notificationColorInfoWeak};
  }
  .sui-bg-notification-positive,
  .sui-hover-bg-notification-positive:hover {
    background-color: ${variables.notificationColorPositiveWeak};
  }
  .sui-bg-notification-warning,
  .sui-hover-bg-notification-warning:hover {
    background-color: ${variables.notificationColorCautionWeak};
  }
  .sui-bg-notification-negative,
  .sui-hover-bg-notification-negative:hover {
    background-color: ${variables.notificationColorNegativeWeak};
  }
  .sui-bg-status-info {
    background-color: ${variables.severityColorInfo};
  }
  .sui-bg-status-positive {
    background-color: ${variables.severityColorNormal};
  }
  .sui-bg-status-warning {
    background-color: ${variables.severityColorWarning};
  }
  .sui-bg-status-negative {
    background-color: ${variables.severityColorCritical};
  }
  .sui-bg-status-unknown {
    background-color: ${variables.severityColorUnknown};
  }
  .sui-bg-progress-track {
    background-color: ${variables.neutral100};
  }
  .sui-bg-accent {
    background-color: ${variables.interactiveColorAccent};
  }
  .sui-hover-bg-page:hover,
  .sui-focus-bg-page:focus {
    background-color: ${variables.backgroundColorPage};
  }
  .sui-hover-bg-section:hover,
  .sui-focus-bg-section:focus {
    background-color: ${variables.backgroundColorSection};
  }
  .sui-hover-bg-floating:hover {
    background-color: ${variables.backgroundColorFloating};
  }
  .sui-focus-bg-info:focus,
  .group:hover .sui-group-hover-bg-info,
  [class*="group/"]:hover .sui-group-hover-bg-info {
    background-color: ${variables.statusColorInfoWeak};
  }
  .group:hover .sui-group-hover-bg-accent,
  [class*="group/"]:hover .sui-group-hover-bg-accent,
  .sui-active-bg-accent:active {
    background-color: ${variables.interactiveColorAccent};
  }
  .sui-hover-bg-info:hover {
    background-color: ${variables.statusColorInfoWeak};
  }
  .sui-hover-bg-positive:hover {
    background-color: ${variables.statusColorNormalWeak};
  }
  .sui-hover-bg-warning:hover {
    background-color: ${variables.statusColorMediumWeak};
  }
  .sui-hover-bg-negative:hover {
    background-color: ${variables.statusColorCriticalWeak};
  }
  .sui-hover-bg-accent:hover {
    background-color: ${variables.interactiveColorAccent};
  }
  .sui-disabled-bg:disabled,
  .sui-disabled-bg[aria-disabled="true"],
  .sui-disabled-bg-page:disabled,
  .sui-disabled-bg-section:disabled,
  .sui-disabled-bg-popup:disabled,
  .sui-disabled-bg-floating:disabled {
    background-color: ${variables.interactiveColorBackgroundDisabled};
  }
`;

const borderStyles = css`
  .sui-border-default,
  .sui-hover-border-default:hover,
  .sui-focus-border-default:focus {
    border-color: ${variables.borderColor};
  }
  .sui-border-weak {
    border-color: ${variables.borderColorWeak};
  }
  .sui-border-strong,
  .sui-hover-border-strong:hover,
  .sui-focus-border-strong:focus {
    border-color: ${variables.borderColorStrong};
  }
  .sui-border-interactive,
  .sui-hover-border-interactive:hover,
  .sui-focus-border-interactive:focus,
  .sui-focus-visible-border-interactive:focus-visible {
    border-color: ${variables.interactiveColorBorder};
  }
  .sui-border-info {
    border-color: ${variables.statusColorInfo};
  }
  .sui-border-positive {
    border-color: ${variables.statusColorNormal};
  }
  .sui-border-warning {
    border-color: ${variables.statusColorMedium};
  }
  .sui-border-negative {
    border-color: ${variables.statusColorCritical};
  }
  .sui-border-notification-info {
    border-color: ${variables.notificationColorInfoStrong};
  }
  .sui-border-notification-positive {
    border-color: ${variables.notificationColorPositiveStrong};
  }
  .sui-border-notification-warning {
    border-color: ${variables.notificationColorCautionStrong};
  }
  .sui-border-notification-negative {
    border-color: ${variables.notificationColorNegativeStrong};
  }
  .sui-border-transparent {
    border-color: transparent;
  }
  .sui-hover-border-info:hover,
  .sui-focus-border-info:focus,
  .group:hover .sui-group-hover-border-info,
  [class*="group/"]:hover .sui-group-hover-border-info {
    border-color: ${variables.statusColorInfo};
  }
  .sui-hover-border-positive:hover {
    border-color: ${variables.statusColorNormal};
  }
  .sui-hover-border-warning:hover {
    border-color: ${variables.statusColorMedium};
  }
  .sui-hover-border-negative:hover {
    border-color: ${variables.statusColorCritical};
  }
  .sui-disabled-border-weak:disabled {
    border-color: ${variables.borderColorWeak};
  }
  .sui-divide-weak > :not([hidden]) ~ :not([hidden]) {
    border-color: ${variables.borderColorWeak};
  }
`;

const focusAndSvgStyles = css`
  .sui-focus-ring:focus,
  .sui-focus-visible-ring:focus-visible,
  .sui-ring-focus {
    box-shadow: ${variables.focusShadow};
  }
  .sui-color-current,
  .sui-hover-color-current:hover {
    color: currentColor;
  }
  .sui-color-transparent {
    color: transparent;
  }
  .sui-disabled-color-default:disabled,
  .sui-disabled-color-muted:disabled {
    color: ${variables.contentColorDisabled};
  }
  .sui-fill-current {
    fill: currentColor;
  }
  .sui-fill-active {
    fill: ${variables.contentColorActive};
  }
  .sui-fill-default {
    fill: ${variables.contentColorDefault};
  }
  .sui-fill-muted {
    fill: ${variables.contentColorMuted};
  }
  .sui-fill-info {
    fill: ${variables.contentColorInfo};
  }
  .sui-fill-positive {
    fill: ${variables.contentColorPositive};
  }
  .sui-fill-warning {
    fill: ${variables.contentColorWarning};
  }
  .sui-fill-negative {
    fill: ${variables.contentColorNegative};
  }
  .sui-stroke-current {
    stroke: currentColor;
  }
  .sui-stroke-default {
    stroke: ${variables.contentColorDefault};
  }
  .sui-stroke-info {
    stroke: ${variables.contentColorInfo};
  }
  .sui-stroke-positive {
    stroke: ${variables.contentColorPositive};
  }
  .sui-stroke-warning {
    stroke: ${variables.contentColorWarning};
  }
  .sui-stroke-negative {
    stroke: ${variables.contentColorNegative};
  }
  .sui-placeholder-muted::placeholder {
    color: ${variables.contentColorMuted};
  }
  .sui-guidance-content a {
    color: ${variables.contentColorLink};
  }
  .sui-guidance-content code {
    background-color: ${variables.backgroundColorSection};
    border-color: ${variables.borderColorWeak};
    color: ${variables.contentColorDefault};
  }
  .sui-important-bg-accent {
    background-color: ${variables.interactiveColorAccent} !important;
  }
  .sui-important-bg-info {
    background-color: ${variables.statusColorInfoWeak} !important;
  }
  .sui-important-border-weak {
    border-color: ${variables.borderColorWeak} !important;
  }
  .sui-important-border-strong {
    border-color: ${variables.borderColorStrong} !important;
  }
  .sui-important-border-info {
    border-color: ${variables.statusColorInfo} !important;
  }
  .sui-shadow-overlay {
    box-shadow: ${variables.overlayShadow};
  }
  .sui-shadow-inset {
    box-shadow: ${variables.focusShadowInset};
  }
  .sui-ring-offset-page {
    --tw-ring-offset-color: ${variables.backgroundColorPage};
  }
  .sui-gradient-from-section {
    --tw-gradient-from: ${variables.backgroundColorSection}
      var(--tw-gradient-from-position);
    --tw-gradient-to: transparent var(--tw-gradient-to-position);
    --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to);
  }
  .sui-gradient-from-transparent {
    --tw-gradient-from: transparent var(--tw-gradient-from-position);
    --tw-gradient-to: transparent var(--tw-gradient-to-position);
    --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to);
  }
  .sui-gradient-via-info {
    --tw-gradient-to: transparent var(--tw-gradient-to-position);
    --tw-gradient-stops:
      var(--tw-gradient-from),
      ${variables.statusColorInfoWeak} var(--tw-gradient-via-position),
      var(--tw-gradient-to);
  }
  .sui-gradient-via-section {
    --tw-gradient-to: transparent var(--tw-gradient-to-position);
    --tw-gradient-stops:
      var(--tw-gradient-from),
      ${variables.backgroundColorSection} var(--tw-gradient-via-position),
      var(--tw-gradient-to);
  }
  .sui-gradient-to-info {
    --tw-gradient-to: ${variables.statusColorInfoWeak}
      var(--tw-gradient-to-position);
  }
  .sui-gradient-to-section {
    --tw-gradient-to: ${variables.backgroundColorSection}
      var(--tw-gradient-to-position);
  }
  .sui-gradient-to-transparent {
    --tw-gradient-to: transparent var(--tw-gradient-to-position);
  }
`;

const GlobalSemanticThemeStyles = createGlobalStyle`
    #scan-root {
        background-color: ${variables.backgroundColorPage};
        color: ${variables.contentColorDefault};
        font-family: ${variables.fontFamily};
        font-size: ${variables.fontSize};

        /* Compatibility boundary for the remaining raw feature CSS. New and
         * migrated React styling uses the semantic classes below directly. */
        --sui-background-page: ${variables.backgroundColorPage};
        --sui-background-section: ${variables.backgroundColorSection};
        --sui-background-popup: ${variables.backgroundColorPopup};
        --sui-background-floating: ${variables.backgroundColorFloating};
        --sui-content-active: ${variables.contentColorActive};
        --sui-content-default: ${variables.contentColorDefault};
        --sui-content-muted: ${variables.contentColorMuted};
        --sui-content-disabled: ${variables.contentColorDisabled};
        --sui-content-link: ${variables.contentColorLink};
        --sui-content-negative: ${variables.contentColorNegative};
        --sui-content-positive: ${variables.contentColorPositive};
        --sui-content-warning: ${variables.contentColorWarning};
        --sui-content-info: ${variables.contentColorInfo};
        --sui-border: ${variables.borderColor};
        --sui-interactive-accent: ${variables.interactiveColorAccent};
        --sui-interactive-border: ${variables.interactiveColorBorder};
        --sui-interactive-hover: ${variables.interactiveColorOverlayHover};
        --sui-interactive-selected: ${variables.interactiveColorOverlaySelected};
        --sui-focus-color: ${variables.focusColor};
        --sui-font-family: ${variables.fontFamily};
        --sui-font-family-title: ${variables.fontFamilyTitle};
        --sui-font-size-small: ${variables.fontSizeSmall};
        --sui-font-size-default: ${variables.fontSize};
        --sui-border-radius: ${variables.borderRadius};

        /* Compatibility names used by legacy visualization CSS. UI roles are
         * sourced from SUI; literal Cisco/chart colors remain visualization data. */
        --scd-c3-canvas: ${variables.backgroundColorPage};
        --scd-c3-panel: ${variables.backgroundColorSection};
        --scd-c3-secondary: ${variables.backgroundColorPopup};
        --scd-c3-text: ${variables.contentColorActive};
        --scd-c3-muted: ${variables.contentColorMuted};
        --scd-c3-info: ${variables.contentColorInfo};
        --scd-c3-positive: ${variables.contentColorPositive};
        --scd-c3-caution: ${variables.contentColorWarning};
        --scd-c3-critical: ${variables.contentColorNegative};
        --scd-c3-panel-border: ${variables.borderColorWeak};
        --scd-c3-toolbar-border: ${variables.borderColor};
        --scd-c3-accent-stroke: ${variables.interactiveColorBorder};
    }

    body.scd-overview-active #scan-root {
        padding-inline: ${variables.spacingLarge};
    }

    /* Temporary compatibility for Heading styles colliding with pre-SUI CSS. */
    body.scd-overview-active #scan-root [data-sui-heading-variant="title1"] {
        ${headingTypography("title1")}
    }

    body.scd-overview-active #scan-root [data-sui-heading-variant="title2"] {
        ${headingTypography("title2")}
    }

    body.scd-overview-active #scan-root [data-sui-heading-variant="title3"] {
        ${headingTypography("title3")}
    }

    body.scd-overview-active #scan-root [data-sui-heading-variant="title4"] {
        ${headingTypography("title4")}
    }

    body.scd-overview-active #scan-root [data-sui-heading-variant="title5"] {
        ${headingTypography("title5")}
    }

    body.scd-overview-active #scan-root [data-sui-heading-variant="title6"] {
        ${headingTypography("title6")}
    }

    ${stateStyles}
    ${backgroundStyles}
    ${borderStyles}
    ${focusAndSvgStyles}
`;

// styled-components v5's GlobalStyleComponent type is not compatible with the
// React 18 JSX constructor type bundled by this app, although it is a valid
// runtime component. Keep that package-level typing mismatch at this boundary.
const SemanticThemeStyles =
  GlobalSemanticThemeStyles as unknown as ComponentType;

export default SemanticThemeStyles;
