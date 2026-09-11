import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Badge from "@splunk/react-ui/Badge";
import Button from "@splunk/react-ui/Button";
import Dropdown from "@splunk/react-ui/Dropdown";
import Menu from "@splunk/react-ui/Menu";
import { variables } from "@splunk/themes";
import styled, { css, keyframes } from "styled-components";
import {
  ExternalLink,
  Palette,
  Pause,
  Play,
  Settings2,
} from "@/common/icons/SuiIcon";
import { cn } from "@/common/lib/utils";
import {
  readUserScopedStorageItem,
  userScopedStorageKey,
} from "@/common/config/insightsWorkspaces";
import type { MetricStatus } from "@/common/hooks/useMetric";
import type {
  SignalTickerDensity,
  SignalTickerFontSize,
  SignalTickerRows,
} from "@/common/hooks/usePersistedSignalTicker";
import { OneCdGlassCard } from "./OneCdPrimitives";

export type SignalRailStatus = MetricStatus;
export type SignalRailDeltaDirection = "up" | "down" | "flat";
export type SignalRailVariant =
  | "one-cisco-glass"
  | "original"
  | "bloomberg"
  | "minimal-enterprise"
  | "telemetry-constellation";

export interface SignalRailKpi {
  id: string;
  label: string;
  value: string | number;
  unit?: string;
  status: SignalRailStatus;
  category: string;
  delta?: string | number;
  deltaDir?: SignalRailDeltaDirection;
  href?: string;
  canOpen?: boolean;
}

interface SignalRailTickerProps {
  kpis: SignalRailKpi[];
  className?: string;
  density?: SignalTickerDensity;
  fontSize?: SignalTickerFontSize;
  rows?: SignalTickerRows;
  durationSeconds?: number;
  onOpenEditor?: () => void;
}

const STORAGE_KEY = "signalRailVariant";
const DEFAULT_VARIANT: SignalRailVariant = "one-cisco-glass";

const VARIANT_OPTIONS: Array<{
  id: SignalRailVariant;
  label: string;
  description: string;
}> = [
  {
    id: "one-cisco-glass",
    label: "One Cisco Glass",
    description: "1CD spotlight with SUI glass status cards",
  },
  {
    id: "original",
    label: "Original",
    description: "Classic KPI cards with semantic status accents",
  },
  {
    id: "bloomberg",
    label: "Bloomberg Terminal",
    description: "Dense mono feed with semantic signal colors",
  },
  {
    id: "minimal-enterprise",
    label: "Minimal Enterprise",
    description: "Theme-aware chip cards with status bars",
  },
  {
    id: "telemetry-constellation",
    label: "Telemetry Constellation",
    description: "1CD glass rail with live signal paths",
  },
];

const SignalRailControls = styled.div`
  position: absolute;
  top: 50%;
  right: ${variables.spacingSmall};
  z-index: 2;
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: ${variables.spacingXSmall};
  padding: ${variables.spacingXSmall};
  border: 1px solid ${variables.borderColorWeak};
  border-radius: ${variables.borderRadius};
  background-color: ${variables.backgroundColorPopup};
  box-shadow: ${variables.overlayShadow};
  opacity: 0;
  pointer-events: none;
  transform: translate(${variables.spacingSmall}, -50%);
  transition:
    opacity 120ms ease,
    transform 120ms ease;

  .scd-signal-rail-ticker:hover &,
  .scd-signal-rail-ticker:focus-within & {
    opacity: 1;
    pointer-events: auto;
    transform: translate(0, -50%);
  }

  @media (any-hover: none), (any-pointer: coarse) {
    position: static;
    opacity: 1;
    pointer-events: auto;
    transform: none;
  }

  @media (prefers-reduced-motion: reduce) {
    transform: translate(0, -50%);
    transition: none;
  }

  @media (prefers-reduced-motion: reduce) and (any-hover: none),
    (prefers-reduced-motion: reduce) and (any-pointer: coarse) {
    transform: none;
  }
`;

const SignalRailStyleMenu = styled(Menu)`
  width: min(22rem, calc(100vw - ${variables.spacingXXLarge}));
`;

const SignalRailStyleSwatch = styled.span<{ $variant: SignalRailVariant }>`
  display: block;
  width: ${variables.spacingXXLarge};
  height: ${variables.spacingXLarge};
  flex: 0 0 auto;
  border-radius: ${variables.borderRadius};
  ${({ $variant }) => {
    switch ($variant) {
      case "one-cisco-glass":
        return css`
          border: 1px solid ${variables.interactiveColorBorder};
          background: linear-gradient(
            135deg,
            ${variables.backgroundColorSection},
            ${variables.interactiveColorBorder}
          );
        `;
      case "original":
        return css`
          border: 1px solid ${variables.severityColorNormal};
          background: linear-gradient(
            135deg,
            ${variables.backgroundColorSection} 0 74%,
            ${variables.severityColorNormal} 74% 100%
          );
        `;
      case "bloomberg":
        return css`
          border: 1px solid ${variables.borderColorStrong};
          background: linear-gradient(
            135deg,
            ${variables.backgroundColorPage},
            ${variables.backgroundColorSection}
          );
        `;
      case "minimal-enterprise":
        return css`
          border: 1px solid ${variables.borderColor};
          background: linear-gradient(
            135deg,
            ${variables.backgroundColorSection} 0 82%,
            ${variables.severityColorInfo} 82% 100%
          );
        `;
      case "telemetry-constellation":
        return css`
          border: 1px solid ${variables.severityColorInfo};
          background:
            radial-gradient(
              circle at 30% 38%,
              ${variables.uiColorAccent} 0 14%,
              transparent 15%
            ),
            linear-gradient(
              135deg,
              ${variables.backgroundColorPage},
              ${variables.uiColorAccentComplement}
            );
        `;
      default:
        return undefined;
    }
  }}
`;

const signalRailMarquee = keyframes`
  from {
    transform: translateX(0);
  }

  to {
    transform: translateX(-50%);
  }
`;

const SignalRailShell = styled.section`
  .scd-signal-rail-marquee-track {
    width: max-content;
    animation-name: ${signalRailMarquee};
    animation-timing-function: linear;
    animation-iteration-count: infinite;
    will-change: transform;
  }

  .scd-signal-rail-marquee-track[data-paused="true"] {
    animation-play-state: paused;
  }

  &.scd-signal-rail-constellation {
    background:
      radial-gradient(
        circle at 12% 35%,
        color-mix(in srgb, ${variables.uiColorAccent} 26%, transparent),
        transparent 28%
      ),
      radial-gradient(
        circle at 88% 42%,
        color-mix(
          in srgb,
          ${variables.uiColorAccentComplement} 22%,
          transparent
        ),
        transparent 32%
      ),
      linear-gradient(
        100deg,
        ${variables.backgroundColorPage} 0%,
        color-mix(
            in srgb,
            ${variables.backgroundColorPage} 88%,
            ${variables.uiColorAccent}
          )
          42%,
        ${variables.backgroundColorSection} 100%
      );
  }

  &.scd-signal-rail-constellation::before {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(
        color-mix(
            in srgb,
            ${variables.severityColorInfo} 10%,
            transparent
          )
          1px,
        transparent 1px
      ),
      linear-gradient(
        90deg,
        color-mix(in srgb, ${variables.severityColorInfo} 9%, transparent) 1px,
        transparent 1px
      );
    background-size: 28px 28px;
    content: "";
    mask-image: linear-gradient(
      90deg,
      transparent,
      ${variables.backgroundColorPage} 10%,
      ${variables.backgroundColorPage} 90%,
      transparent
    );
    pointer-events: none;
  }

  &.scd-signal-rail-constellation::after {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent,
      color-mix(in srgb, ${variables.uiColorAccent} 18%, transparent),
      transparent
    );
    content: "";
    pointer-events: none;
  }

  .scd-signal-rail-constellation-card::before {
    position: absolute;
    inset: 5px;
    border: 1px solid
      color-mix(in srgb, ${variables.severityColorInfo} 16%, transparent);
    border-radius: 999px;
    content: "";
    pointer-events: none;
  }

  .scd-signal-rail-constellation-card::after {
    position: absolute;
    top: 50%;
    right: 18px;
    width: 54px;
    height: 54px;
    transform: translateY(-50%);
    border: 1px dashed
      color-mix(in srgb, ${variables.uiColorAccent} 28%, transparent);
    border-radius: 999px;
    content: "";
    opacity: 0.7;
    pointer-events: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .scd-signal-rail-marquee-track {
      animation: none !important;
      transform: none !important;
    }
  }
`;

const STATUS_LABEL: Record<SignalRailStatus, string> = {
  healthy: "Healthy",
  warning: "Warning",
  critical: "Critical",
  unknown: "Watching",
};

const STATUS_COLOR = {
  healthy: {
    accent: "sui-bg-positive",
    border: "sui-border-positive",
    text: "sui-color-positive",
    textOnDark: "sui-color-positive",
    glow: "sui-bg-positive sui-shadow-overlay",
  },
  warning: {
    accent: "sui-bg-warning",
    border: "sui-border-warning",
    text: "sui-color-warning",
    textOnDark: "sui-color-warning",
    glow: "sui-bg-warning sui-shadow-overlay",
  },
  critical: {
    accent: "sui-bg-negative",
    border: "sui-border-negative",
    text: "sui-color-negative",
    textOnDark: "sui-color-negative",
    glow: "sui-bg-negative sui-shadow-overlay",
  },
  unknown: {
    accent: "sui-bg-floating",
    border: "sui-border-default",
    text: "sui-color-muted sui-color-default",
    textOnDark: "sui-color-active",
    glow: "sui-bg-floating sui-shadow-overlay",
  },
} satisfies Record<SignalRailStatus, Record<string, string>>;

const STATUS_PILL_TOKENS = {
  healthy: variables.severityColorNormal,
  warning: variables.severityColorNotice,
  critical: variables.severityColorAlert,
  unknown: variables.severityColorUnknown,
};

const StatusPill = styled(Badge)<{ $status: SignalRailStatus }>`
  min-height: 24px;
  padding: ${variables.spacingXSmall} ${variables.spacingSmall};
  border: 1px solid ${({ $status }) => STATUS_PILL_TOKENS[$status]};
  border-radius: 9999px;
  background-color: color-mix(
    in srgb,
    ${({ $status }) => STATUS_PILL_TOKENS[$status]} 50%,
    transparent
  );
  color: ${variables.contentColorActive};
  font-family: ${variables.fontFamily};
  font-size: ${variables.fontSizeSmall};
  font-weight: ${variables.fontWeightSemiBold};
  line-height: ${variables.lineHeightSingle};
  white-space: nowrap;
`;

const MetricContent = styled.span`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  min-width: 0;
  width: 100%;
  margin-top: ${variables.spacingSmall};
  gap: ${variables.spacingSmall};
`;

const MetricValue = styled.span<{ $status: SignalRailStatus }>`
  min-width: 0;
  max-width: 100%;
  color: ${({ $status }) => STATUS_PILL_TOKENS[$status]};
  font-family: ${variables.fontFamily};
  font-size: 2.65rem;
  font-weight: ${variables.fontWeightBold};
  line-height: ${variables.lineHeightSingle};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const isSignalRailVariant = (
  value: string | null,
): value is SignalRailVariant =>
  value === "one-cisco-glass" ||
  value === "original" ||
  value === "bloomberg" ||
  value === "minimal-enterprise" ||
  value === "telemetry-constellation";

const readStoredVariant = (): SignalRailVariant => {
  if (typeof window === "undefined") return DEFAULT_VARIANT;
  try {
    const stored = readUserScopedStorageItem(userScopedStorageKey(STORAGE_KEY));
    return isSignalRailVariant(stored) ? stored : DEFAULT_VARIANT;
  } catch {
    return DEFAULT_VARIANT;
  }
};

const writeStoredVariant = (variant: SignalRailVariant): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(userScopedStorageKey(STORAGE_KEY), variant);
  } catch {
    // Storage can be disabled; keep the in-session selection.
  }
};

const splitRows = (
  kpis: SignalRailKpi[],
  rows: SignalTickerRows,
): SignalRailKpi[][] => {
  if (rows === 2 && kpis.length > 3) {
    return [
      kpis.filter((_, idx) => idx % 2 === 0),
      kpis.filter((_, idx) => idx % 2 === 1),
    ].filter((row) => row.length > 0);
  }
  return [kpis];
};

const valueText = (kpi: SignalRailKpi): string =>
  `${kpi.value}${kpi.unit ?? ""}`;

const deltaText = (kpi: SignalRailKpi): string => {
  if (kpi.delta === undefined || kpi.delta === null || kpi.delta === "") {
    return "+0";
  }
  const prefix =
    kpi.deltaDir === "down" ? "-" : kpi.deltaDir === "up" ? "+" : "+";
  return `${prefix}${kpi.delta}`;
};

const deltaArrow = (dir: SignalRailDeltaDirection | undefined): string => {
  if (dir === "up") return "▲";
  if (dir === "down") return "▼";
  return "•";
};

const deltaClass = (dir: SignalRailDeltaDirection | undefined): string => {
  if (dir === "up") return "sui-color-negative";
  if (dir === "down") return "sui-color-positive";
  return "sui-color-info";
};

const categoryLabel = (category: string): string => {
  const parts = category
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts[parts.length - 1] || category || "Cisco Enterprise";
};

const passClass = (
  variant: SignalRailVariant,
  density: SignalTickerDensity,
): string =>
  cn(
    "flex shrink-0",
    density === "compact" ? "gap-3" : "gap-4",
    variant === "bloomberg" && "gap-0",
    variant === "telemetry-constellation" && "gap-4",
    variant === "original" && "gap-3",
    variant === "minimal-enterprise" && "gap-4",
    variant === "one-cisco-glass" && "gap-3",
  );

const itemSizeClass = (
  variant: SignalRailVariant,
  density: SignalTickerDensity,
): string => {
  if (variant === "one-cisco-glass") {
    return density === "compact" ? "min-w-0 px-4 py-3" : "min-w-0 px-5 py-4";
  }
  if (variant === "bloomberg") {
    return density === "compact"
      ? "h-[62px] min-w-[280px] px-7"
      : "h-[76px] min-w-[320px] px-8";
  }
  if (variant === "minimal-enterprise") {
    return density === "compact"
      ? "h-[54px] min-w-[282px] px-4"
      : "h-[68px] min-w-[320px] px-5";
  }
  if (variant === "telemetry-constellation") {
    return density === "compact"
      ? "h-[58px] min-w-[310px] px-5"
      : "h-[72px] min-w-[350px] px-6";
  }
  return density === "compact"
    ? "h-[62px] min-w-[238px] px-3 py-2.5"
    : "h-[82px] min-w-[265px] px-4 py-3";
};

const fontSizeClass = (
  fontSize: SignalTickerFontSize,
  small: string,
  standard: string,
  large: string,
): string => {
  if (fontSize === "small") return small;
  if (fontSize === "large") return large;
  return standard;
};

interface KpiItemProps {
  kpi: SignalRailKpi;
  variant: SignalRailVariant;
  density: SignalTickerDensity;
  fontSize: SignalTickerFontSize;
  duplicate?: boolean;
}

const KpiItem: React.FC<KpiItemProps> = ({
  kpi,
  variant,
  density,
  fontSize,
  duplicate = false,
}) => {
  const status = STATUS_COLOR[kpi.status];
  const label = kpi.label;
  const category = categoryLabel(kpi.category);
  const openTabIndex = duplicate ? -1 : 0;
  const openLink =
    kpi.canOpen !== false && kpi.href ? (
      <a
        href={kpi.href}
        target="_blank"
        rel="noopener noreferrer"
        tabIndex={openTabIndex}
        title={`Open ${label} in Search`}
        aria-label={`Open ${label} in Search`}
        className="inline-flex rounded p-0.5 sui-color-current opacity-55 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 sui-focus-visible-ring"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <ExternalLink className="h-3 w-3 sui-stroke-default" />
      </a>
    ) : null;

  if (variant === "one-cisco-glass") {
    return (
      <OneCdGlassCard
        tag="article"
        className={cn(
          "scd-signal-rail-item flex flex-col gap-0 overflow-hidden",
          itemSizeClass(variant, density),
        )}
        data-status={kpi.status}
      >
        <span className="flex min-w-0 items-start justify-between gap-3">
          <span className="min-w-0">
            <span
              className={cn(
                "block truncate font-bold  sui-color-active",
                fontSizeClass(fontSize, "text-xs", "text-sm", "text-base"),
              )}
            >
              {label}
            </span>
            <span
              className={cn(
                "mt-1 block truncate  sui-color-default",
                fontSizeClass(
                  fontSize,
                  "sui-color-default",
                  "text-xs",
                  "text-sm",
                ),
              )}
            >
              {category}
            </span>
          </span>
          {openLink}
        </span>
        <MetricContent>
          <MetricValue $status={kpi.status}>{valueText(kpi)}</MetricValue>
          <StatusPill $status={kpi.status} label={STATUS_LABEL[kpi.status]} />
        </MetricContent>
      </OneCdGlassCard>
    );
  }

  if (variant === "bloomberg") {
    return (
      <div
        className={cn(
          "scd-signal-rail-item flex items-center border-r sui-border-default sui-bg-section font-mono sui-color-active",
          itemSizeClass(variant, density),
        )}
        data-status={kpi.status}
      >
        <span
          className={cn("mr-4 h-2.5 w-2.5 shrink-0 rounded-full", status.glow)}
        />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate font-bold uppercase tracking-[0.18em] sui-color-info",
              fontSizeClass(
                fontSize,
                "sui-color-default",
                "sui-color-default",
                "sui-color-default",
              ),
            )}
          >
            {label}
          </span>
          <span className="mt-1 flex items-baseline gap-3">
            <span
              className={cn(
                "font-black leading-none sui-color-positive",
                fontSizeClass(
                  fontSize,
                  "sui-color-default",
                  "sui-color-default",
                  "sui-color-default",
                ),
              )}
            >
              {valueText(kpi)}
            </span>
            <span
              className={cn(
                "font-black",
                fontSizeClass(
                  fontSize,
                  "sui-color-default",
                  "sui-color-default",
                  "sui-color-default",
                ),
                deltaClass(kpi.deltaDir),
              )}
            >
              {deltaArrow(kpi.deltaDir)} {deltaText(kpi)}
            </span>
          </span>
        </span>
        {openLink}
      </div>
    );
  }

  if (variant === "minimal-enterprise") {
    return (
      <div
        className={cn(
          "scd-signal-rail-item relative flex items-center overflow-hidden rounded-lg border    shadow-sm sui-border-default sui-bg-section sui-color-active",
          itemSizeClass(variant, density),
        )}
        data-status={kpi.status}
      >
        <span className={cn("absolute inset-y-0 left-0 w-1", status.accent)} />
        <div className="min-w-0 flex-1 pl-2">
          <span
            className={cn(
              "block truncate font-black uppercase tracking-[0.12em]  sui-color-default",
              fontSizeClass(
                fontSize,
                "sui-color-default",
                "text-xs",
                "text-sm",
              ),
            )}
          >
            {label}
          </span>
          <span
            className={cn(
              "mt-0.5 block truncate font-semibold  sui-color-muted",
              fontSizeClass(
                fontSize,
                "sui-color-default",
                "text-xs",
                "sui-color-default",
              ),
            )}
          >
            {kpi.category}
          </span>
        </div>
        <span className="mx-4 h-8 w-px  sui-bg-floating" />
        <span
          className={cn(
            "shrink-0 font-black leading-none  sui-color-active",
            fontSizeClass(
              fontSize,
              "sui-color-default",
              "sui-color-default",
              "sui-color-default",
            ),
          )}
        >
          {valueText(kpi)}
        </span>
        <span className="ml-4 flex shrink-0 items-center gap-1.5">
          <span className={cn("h-2.5 w-2.5 rounded-full", status.glow)} />
          <span
            className={cn(
              "font-black uppercase tracking-[0.08em]",
              fontSizeClass(
                fontSize,
                "sui-color-default",
                "text-xs",
                "sui-color-default",
              ),
              status.text,
            )}
          >
            {STATUS_LABEL[kpi.status]}
          </span>
        </span>
        <span className="ml-3">{openLink}</span>
      </div>
    );
  }

  if (variant === "telemetry-constellation") {
    return (
      <div
        className={cn(
          "scd-signal-rail-item scd-signal-rail-constellation-card relative flex items-center overflow-hidden rounded-full border sui-border-info sui-bg-page sui-color-info sui-shadow-overlay backdrop-blur-md",
          itemSizeClass(variant, density),
        )}
        data-status={kpi.status}
      >
        <span
          className={cn(
            "relative z-10 mr-4 h-3 w-3 shrink-0 rounded-full ring-4 sui-focus-ring",
            status.glow,
          )}
        />
        <span className="relative z-10 min-w-0 flex-1">
          <span
            className={cn(
              "block truncate font-black uppercase tracking-[0.22em] sui-color-info",
              fontSizeClass(
                fontSize,
                "sui-color-default",
                "text-xs",
                "sui-color-default",
              ),
            )}
          >
            {category}
          </span>
          <span className="mt-1 flex min-w-0 items-baseline gap-3">
            <span
              className={cn(
                "truncate font-black uppercase tracking-[0.12em] sui-color-info",
                fontSizeClass(
                  fontSize,
                  "sui-color-default",
                  "sui-color-default",
                  "sui-color-default",
                ),
              )}
            >
              {label}
            </span>
            <span
              className={cn(
                "shrink-0 font-mono font-black leading-none sui-color-active sui-shadow-overlay",
                fontSizeClass(
                  fontSize,
                  "sui-color-default",
                  "sui-color-default",
                  "sui-color-default",
                ),
              )}
            >
              {valueText(kpi)}
            </span>
          </span>
        </span>
        <span className="relative z-10 ml-4 flex shrink-0 items-center gap-2 pr-1">
          <span
            className={cn(
              "font-black uppercase tracking-[0.16em]",
              fontSizeClass(
                fontSize,
                "sui-color-default",
                "text-xs",
                "sui-color-default",
              ),
              status.textOnDark,
            )}
          >
            {STATUS_LABEL[kpi.status]}
          </span>
          {openLink}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "scd-signal-rail-item group relative overflow-hidden rounded-lg border  text-left shadow-sm transition-all sui-bg-section sui-color-active",
        itemSizeClass(variant, density),
        status.border,
      )}
      data-status={kpi.status}
    >
      <span className={cn("absolute left-0 top-0 h-full w-1", status.accent)} />
      <span
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r sui-gradient-from-transparent sui-gradient-to-transparent sui-gradient-via-info"
        aria-hidden="true"
      />
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span
            className={cn(
              "block truncate font-black leading-none tracking-normal  sui-color-active",
              fontSizeClass(
                fontSize,
                "sui-color-default",
                "sui-color-default",
                "sui-color-default",
              ),
            )}
          >
            {valueText(kpi)}
          </span>
          <span
            className={cn(
              "mt-1.5 block line-clamp-2 font-black uppercase leading-tight tracking-[0.08em]  sui-color-default",
              fontSizeClass(
                fontSize,
                "sui-color-default",
                "text-xs",
                "text-sm",
              ),
            )}
          >
            {label}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-0.5">
          <StatusPill
            $status={kpi.status}
            backgroundColor={variables.backgroundColorPopup}
            foregroundColor={STATUS_PILL_TOKENS[kpi.status]}
            label={STATUS_LABEL[kpi.status]}
          />
          {openLink}
        </span>
      </span>
      <span
        className={cn(
          "mt-0.5 block truncate font-semibold  sui-color-muted",
          fontSizeClass(
            fontSize,
            "sui-color-default",
            "text-xs",
            "sui-color-default",
          ),
        )}
      >
        {kpi.category}
      </span>
    </div>
  );
};

export const SignalRailTicker: React.FC<SignalRailTickerProps> = ({
  kpis,
  className,
  density = "comfortable",
  fontSize = "standard",
  rows = 1,
  durationSeconds = 60,
  onOpenEditor,
}) => {
  const [variant, setVariant] = useState<SignalRailVariant>(() =>
    readStoredVariant(),
  );
  const [manualPaused, setManualPaused] = useState(false);
  const [interactionPaused, setInteractionPaused] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== userScopedStorageKey(STORAGE_KEY)) return;
      setVariant(readStoredVariant());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const selectVariant = useCallback((nextVariant: SignalRailVariant) => {
    setVariant(nextVariant);
    writeStoredVariant(nextVariant);
  }, []);

  const tickerRows = useMemo(() => splitRows(kpis, rows), [kpis, rows]);
  // Aileen's 1CD status overview is a static set of glass cards. Motion
  // belongs to the connector trails in the topology map, not this rail.
  // Retain marquee support only for the optional legacy rail variants.
  const staticMode = variant === "one-cisco-glass" || durationSeconds <= 0;
  const effectivePaused =
    manualPaused || interactionPaused || durationSeconds <= 0;
  const activeOption = VARIANT_OPTIONS.find((option) => option.id === variant);
  const counts = useMemo(() => {
    const map: Record<SignalRailStatus, number> = {
      healthy: 0,
      warning: 0,
      critical: 0,
      unknown: 0,
    };
    for (const kpi of kpis) map[kpi.status] += 1;
    return map;
  }, [kpis]);

  const renderPass = (row: SignalRailKpi[], pass: number) => (
    <div
      key={`pass-${pass}`}
      className={passClass(variant, density)}
      aria-hidden={pass === 1}
    >
      {row.map((kpi) => (
        <KpiItem
          key={`${pass}-${kpi.id}`}
          kpi={kpi}
          variant={variant}
          density={density}
          fontSize={fontSize}
          duplicate={pass === 1}
        />
      ))}
    </div>
  );

  if (kpis.length === 0) return null;

  return (
    <SignalRailShell
      className={cn(
        "scd-signal-rail-ticker group/signal-rail relative z-40 flex w-full min-w-0 max-w-full flex-shrink-0 flex-col overflow-visible border-b",
        variant === "one-cisco-glass" &&
          "sui-border-transparent sui-bg-transparent py-3  sui-color-active",
        variant === "original" &&
          "sui-border-weak  px-1.5 py-1 sui-border-weak sui-bg-page",
        variant === "bloomberg" &&
          "sui-border-default sui-bg-section px-1.5 py-1 sui-color-active",
        variant === "minimal-enterprise" &&
          "sui-border-weak  px-1.5 py-2  sui-border-weak sui-bg-page sui-color-active",
        variant === "telemetry-constellation" &&
          "scd-signal-rail-constellation sui-border-info px-1.5 py-1.5 sui-color-info",
        className,
      )}
      data-variant={variant}
      data-font-size={fontSize}
      aria-label={`Signal Rail with ${kpis.length} KPIs`}
      onMouseEnter={() => setInteractionPaused(true)}
      onMouseLeave={() => setInteractionPaused(false)}
      onFocusCapture={() => setInteractionPaused(true)}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget;
        if (
          nextTarget instanceof Node &&
          event.currentTarget.contains(nextTarget)
        ) {
          return;
        }
        setInteractionPaused(false);
      }}
    >
      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        Signal health summary: {counts.critical} critical
      </span>
      <div
        className={cn(
          "relative z-[70] flex w-full min-w-0 max-w-full items-center overflow-visible",
          density === "compact" ? "gap-2" : "gap-3",
        )}
      >
        <div
          className={cn(
            "w-full min-w-0 max-w-full flex-1 overflow-hidden select-none",
            density === "compact" ? "space-y-0.5" : "space-y-1",
          )}
        >
          {tickerRows.map((row, rowIndex) => (
            <div
              key={`row-${rowIndex}`}
              className={cn(
                "w-full min-w-0 max-w-full py-0.5",
                staticMode ? "overflow-visible" : "overflow-hidden",
              )}
            >
              {staticMode ? (
                <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
                  {row.map((kpi) => (
                    <KpiItem
                      key={kpi.id}
                      kpi={kpi}
                      variant={variant}
                      density={density}
                      fontSize={fontSize}
                    />
                  ))}
                </div>
              ) : (
                <div
                  className="scd-signal-rail-marquee-track flex"
                  data-paused={effectivePaused}
                  style={{ animationDuration: `${durationSeconds}s` }}
                >
                  {[0, 1].map((pass) => renderPass(row, pass))}
                </div>
              )}
            </div>
          ))}
        </div>

        <SignalRailControls
          className="scd-signal-rail-controls"
          data-signal-rail-controls="true"
        >
          {variant !== "one-cisco-glass" && (
            <Button
              appearance="subtle"
              onClick={() => setManualPaused((current) => !current)}
              disabled={staticMode}
              aria-pressed={manualPaused}
              hideLabel
              icon={
                manualPaused ? (
                  <Play aria-hidden="true" />
                ) : (
                  <Pause aria-hidden="true" />
                )
              }
              label={
                staticMode
                  ? "Signal rail is static; configure speed to enable motion"
                  : manualPaused
                    ? "Resume signal rail"
                    : "Pause signal rail"
              }
            />
          )}
          <Dropdown
            defaultPlacement="below"
            repositionMode="any"
            toggle={
              <Button
                appearance="subtle"
                hideLabel
                icon={<Palette aria-hidden="true" />}
                isMenu
                label={`Signal Rail style: ${activeOption?.label ?? "Original"}`}
              />
            }
          >
            <SignalRailStyleMenu aria-label="Choose Signal Rail style">
              <Menu.Heading title>Signal Rail style</Menu.Heading>
              {VARIANT_OPTIONS.map((option) => (
                <Menu.Item
                  data-variant-option={option.id}
                  description={option.description}
                  key={option.id}
                  onClick={() => selectVariant(option.id)}
                  selectable
                  selected={variant === option.id}
                  startAdornment={
                    <SignalRailStyleSwatch
                      $variant={option.id}
                      aria-hidden="true"
                    />
                  }
                >
                  {option.label}
                </Menu.Item>
              ))}
            </SignalRailStyleMenu>
          </Dropdown>
          {onOpenEditor && (
            <Button
              appearance="subtle"
              hideLabel
              icon={<Settings2 aria-hidden="true" />}
              label="Configure Signal Rail"
              onClick={onOpenEditor}
            />
          )}
        </SignalRailControls>
      </div>

      {variant === "bloomberg" && (
        <div className="relative z-10 border-t sui-border-default px-8 py-2 font-mono text-xs font-bold uppercase tracking-[0.18em] sui-color-info">
          Signal Rail · Live · {kpis.length} KPIs Monitored
        </div>
      )}
      {variant === "minimal-enterprise" && (
        <div className="relative z-0 flex items-center justify-between border-t  px-8 py-2 text-xs font-black uppercase tracking-[0.12em]  sui-border-weak sui-bg-page sui-color-muted">
          <span>Signal Rail · {kpis.length} KPIs</span>
          <span className="normal-case tracking-normal">
            <span className="sui-color-positive">
              • {counts.healthy} Healthy
            </span>
            <span className="ml-3 sui-color-warning">
              • {counts.warning} Warning
            </span>
            <span className="ml-3 sui-color-negative">
              • {counts.critical} Critical
            </span>
          </span>
        </div>
      )}
      {variant === "telemetry-constellation" && (
        <div className="relative z-0 flex items-center justify-between border-t sui-border-info sui-bg-page px-8 py-2 font-mono text-xs font-black uppercase tracking-[0.16em] sui-color-info">
          <span>
            <span className="mr-2 inline-block h-2 w-2 rounded-full sui-bg-info sui-shadow-overlay" />
            Telemetry Constellation
          </span>
          <span className="sui-color-info">
            {counts.healthy} nominal / {counts.warning} drift /{" "}
            {counts.critical} breach
          </span>
        </div>
      )}
    </SignalRailShell>
  );
};

export default SignalRailTicker;
