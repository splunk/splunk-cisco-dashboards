import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Badge from "@splunk/react-ui/Badge";
import Layout from "@splunk/react-ui/Layout";
import { variables } from "@splunk/themes";
import styled from "styled-components";
import {
  Check,
  ExternalLink,
  Palette,
  Pause,
  Play,
  Settings2,
} from "@/common/icons/SuiIcon";
import { cn } from "@/common/lib/utils";
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
  | "cisco-blue-gradient"
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
  swatchClassName: string;
}> = [
  {
    id: "one-cisco-glass",
    label: "One Cisco Glass",
    description: "1CD spotlight with SUI glass status cards",
    swatchClassName:
      "border sui-border-info bg-gradient-to-br sui-gradient-from-section sui-gradient-via-info sui-gradient-to-info",
  },
  {
    id: "original",
    label: "Original",
    description: "White KPI cards with status badges",
    swatchClassName: "sui-bg-section border sui-border-positive",
  },
  {
    id: "bloomberg",
    label: "Bloomberg Terminal",
    description: "Dark monospace feed with glowing dots",
    swatchClassName: "sui-bg-section border sui-border-default",
  },
  {
    id: "cisco-blue-gradient",
    label: "Cisco Blue Gradient",
    description: "Brand gradient with scan lines",
    swatchClassName:
      "bg-gradient-to-br sui-gradient-from-section sui-gradient-via-section sui-gradient-to-section",
  },
  {
    id: "minimal-enterprise",
    label: "Minimal Enterprise",
    description: "Light chip cards with accent bars",
    swatchClassName: "sui-bg-section border sui-border-weak",
  },
  {
    id: "telemetry-constellation",
    label: "Telemetry Constellation",
    description: "Orbital glass rail with live signal paths",
    swatchClassName: "sui-bg-section border sui-border-info",
  },
];

const signalRailTickerCss = `
@keyframes scd-signal-rail-marquee {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
}
.scd-signal-rail-marquee-track {
    width: max-content;
    will-change: transform;
    animation-name: scd-signal-rail-marquee;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
}
.scd-signal-rail-marquee-track[data-paused='true'] {
    animation-play-state: paused;
}
@media (prefers-reduced-motion: reduce) {
    .scd-signal-rail-marquee-track {
        animation: none !important;
        transform: none !important;
    }
}
#scan-root .scd-signal-rail-controls {
    opacity: 0;
    pointer-events: none;
    transform: translate(0.25rem, -50%);
}
#scan-root .scd-signal-rail-ticker:hover .scd-signal-rail-controls,
#scan-root .scd-signal-rail-ticker:focus-within .scd-signal-rail-controls,
#scan-root .scd-signal-rail-controls[data-open='true'] {
    opacity: 1 !important;
    pointer-events: auto;
    transform: translate(0, -50%) !important;
}
.scd-signal-rail-controls {
  display: none !important;
}
.scd-signal-rail-cisco {
    background: linear-gradient(135deg, #0d2b5e 0%, #1749a0 52%, #0d4f8a 100%);
}
.scd-signal-rail-cisco::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image: repeating-linear-gradient(
        0deg,
        rgba(255, 255, 255, 0.08) 0,
        rgba(255, 255, 255, 0.08) 1px,
        transparent 1px,
        transparent 5px
    );
    opacity: 0.45;
    mix-blend-mode: screen;
}
.scd-signal-rail-constellation {
    background:
        radial-gradient(circle at 12% 35%, rgba(34, 211, 238, 0.28), transparent 28%),
        radial-gradient(circle at 88% 42%, rgba(168, 85, 247, 0.24), transparent 32%),
        linear-gradient(100deg, #020617 0%, #07142d 42%, #0c1f3d 100%);
}
.scd-signal-rail-constellation::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image:
        linear-gradient(rgba(125, 211, 252, 0.09) 1px, transparent 1px),
        linear-gradient(90deg, rgba(125, 211, 252, 0.08) 1px, transparent 1px);
    background-size: 28px 28px;
    mask-image: linear-gradient(90deg, transparent, black 10%, black 90%, transparent);
}
.scd-signal-rail-constellation::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(90deg, transparent, rgba(103, 232, 249, 0.16), transparent);
    mix-blend-mode: screen;
}
.scd-signal-rail-constellation-card::before {
    content: "";
    position: absolute;
    inset: 5px;
    border-radius: 999px;
    border: 1px solid rgba(125, 211, 252, 0.12);
    pointer-events: none;
}
.scd-signal-rail-constellation-card::after {
    content: "";
    position: absolute;
    right: 18px;
    top: 50%;
    width: 54px;
    height: 54px;
    transform: translateY(-50%);
    border-radius: 999px;
    border: 1px dashed rgba(103, 232, 249, 0.25);
    opacity: 0.7;
    pointer-events: none;
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
    soft: "sui-bg-positive sui-color-positive sui-border-positive",
    softOnDark: "sui-bg-positive sui-color-positive sui-border-positive",
    glow: "sui-bg-positive sui-shadow-overlay",
  },
  warning: {
    accent: "sui-bg-warning",
    border: "sui-border-warning",
    text: "sui-color-warning",
    textOnDark: "sui-color-warning",
    soft: "sui-bg-warning sui-color-warning sui-border-warning",
    softOnDark: "sui-bg-warning sui-color-warning sui-border-warning",
    glow: "sui-bg-warning sui-shadow-overlay",
  },
  critical: {
    accent: "sui-bg-negative",
    border: "sui-border-negative",
    text: "sui-color-negative",
    textOnDark: "sui-color-negative",
    soft: "sui-bg-negative sui-color-negative sui-border-negative",
    softOnDark: "sui-bg-negative sui-color-negative sui-border-negative",
    glow: "sui-bg-negative sui-shadow-overlay",
  },
  unknown: {
    accent: "sui-bg-floating",
    border: "sui-border-default",
    text: "sui-color-muted sui-color-default",
    textOnDark: "sui-color-active",
    soft: "sui-bg-floating sui-color-active sui-border-default",
    softOnDark: "sui-bg-floating sui-color-active sui-border-weak",
    glow: "sui-bg-floating sui-shadow-overlay",
  },
} satisfies Record<SignalRailStatus, Record<string, string>>;

const STATUS_PILL_TOKENS = {
  healthy: variables.severityColorNormal,
  warning: variables.severityColorNotice, // INTENTIONALLY DIFFERENT TO MATCH FIGMA MOCKUP
  critical: variables.severityColorAlert, // INTENTIONALLY DIFFERENT TO MATCH FIGMA MOCKUP
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

const SignalGlassCard = styled(OneCdGlassCard)`
  transition:
    background-color 140ms ease,
    border-color 140ms ease;

  &::after {
    position: absolute;
    top: 0;
    right: 0;
    left: 0;
    height: 2px;
    border-radius: ${variables.borderRadius} ${variables.borderRadius} 0 0;
    content: "";
    opacity: 0;
    pointer-events: none;
  }

  &[data-status="warning"]::after {
    background-color: ${variables.severityColorNotice};
    opacity: 0.78;
  }

  &[data-status="critical"]::after {
    background-color: ${variables.severityColorAlert};
    opacity: 0.92;
  }

  &[data-status="healthy"] ${MetricValue} {
    color: ${variables.contentColorDefault};
    font-size: 2.35rem;
  }

  &[data-status="healthy"] ${StatusPill} {
    opacity: 0.72;
  }

  &[data-status="healthy"]:hover ${MetricValue},
  &[data-status="healthy"]:focus-within ${MetricValue} {
    color: ${variables.severityColorNormal};
  }

  &[data-status="healthy"]:hover ${StatusPill},
  &[data-status="healthy"]:focus-within ${StatusPill} {
    opacity: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const isSignalRailVariant = (
  value: string | null,
): value is SignalRailVariant =>
  value === "one-cisco-glass" ||
  value === "original" ||
  value === "bloomberg" ||
  value === "cisco-blue-gradient" ||
  value === "minimal-enterprise" ||
  value === "telemetry-constellation";

const readStoredVariant = (): SignalRailVariant => {
  if (typeof window === "undefined") return DEFAULT_VARIANT;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isSignalRailVariant(stored) ? stored : DEFAULT_VARIANT;
  } catch {
    return DEFAULT_VARIANT;
  }
};

const writeStoredVariant = (variant: SignalRailVariant): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, variant);
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
    variant === "cisco-blue-gradient" && "gap-0",
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
  if (variant === "cisco-blue-gradient") {
    return density === "compact"
      ? "h-[62px] min-w-[300px] px-8"
      : "h-[76px] min-w-[340px] px-9";
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
      <SignalGlassCard
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
      </SignalGlassCard>
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

  if (variant === "cisco-blue-gradient") {
    return (
      <div
        className={cn(
          "scd-signal-rail-item flex items-center border-r sui-border-weak sui-color-active",
          itemSizeClass(variant, density),
        )}
        data-status={kpi.status}
      >
        <div className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate font-black uppercase tracking-[0.2em] sui-color-muted",
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
          <span className="mt-1 flex min-w-0 items-center gap-4">
            <span
              className={cn(
                "truncate font-black uppercase tracking-[0.08em] sui-color-active",
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
                "shrink-0 font-black leading-none sui-color-active",
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
                "shrink-0 rounded-full border px-3 py-1 font-black uppercase tracking-[0.12em] sui-shadow-overlay",
                fontSizeClass(
                  fontSize,
                  "sui-color-default",
                  "text-xs",
                  "sui-color-default",
                ),
                status.softOnDark,
              )}
            >
              {STATUS_LABEL[kpi.status]}
            </span>
          </span>
        </div>
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
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 font-black uppercase tracking-[0.12em]",
              fontSizeClass(
                fontSize,
                "sui-color-default",
                "text-xs",
                "sui-color-default",
              ),
              status.soft,
            )}
          >
            {STATUS_LABEL[kpi.status]}
          </span>
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      setVariant(readStoredVariant());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const selectVariant = useCallback((nextVariant: SignalRailVariant) => {
    setVariant(nextVariant);
    writeStoredVariant(nextVariant);
    setPickerOpen(false);
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

  const controlButtonClassName = cn(
    "flex items-center justify-center rounded-md border sui-border-transparent sui-bg-transparent shadow-none transition-colors focus:outline-none focus-visible:ring-2 sui-focus-visible-ring",
    density === "compact" ? "h-8 w-8" : "h-9 w-9",
    variant === "bloomberg"
      ? "sui-color-info sui-hover-bg-accent sui-hover-color-active"
      : variant === "telemetry-constellation"
        ? "sui-color-info sui-hover-bg-info sui-hover-color-active"
        : variant === "cisco-blue-gradient"
          ? "sui-color-active sui-bg-section sui-hover-color-active"
          : "sui-color-muted   sui-color-default sui-hover-bg-info sui-hover-color-info",
  );

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
    <section
      className={cn(
        "scd-signal-rail-ticker group/signal-rail relative z-40 flex w-full min-w-0 max-w-full flex-shrink-0 flex-col overflow-visible border-b",
        variant === "one-cisco-glass" &&
          "sui-border-transparent sui-bg-transparent py-3  sui-color-active",
        variant === "original" &&
          "sui-border-weak  px-1.5 py-1 sui-border-weak sui-bg-page",
        variant === "bloomberg" &&
          "sui-border-default sui-bg-section px-1.5 py-1 sui-color-active",
        variant === "cisco-blue-gradient" &&
          "scd-signal-rail-cisco sui-border-info px-1.5 py-1 sui-color-active",
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
      <style>{signalRailTickerCss}</style>
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

        <div
          className={cn(
            "scd-signal-rail-controls absolute right-2 top-1/2 z-[90] flex items-center gap-0.5 rounded-xl border p-1 shadow-lg transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none",
            variant === "bloomberg"
              ? "sui-border-info sui-bg-section"
              : variant === "telemetry-constellation"
                ? "sui-border-info sui-bg-page sui-shadow-overlay"
                : variant === "cisco-blue-gradient"
                  ? "sui-border-weak sui-bg-page"
                  : "sui-border-default sui-bg-page",
          )}
          data-signal-rail-controls="true"
          data-open={pickerOpen}
          ref={pickerRef}
        >
          {variant !== "one-cisco-glass" && (
            <button
              type="button"
              onClick={() => setManualPaused((current) => !current)}
              disabled={staticMode}
              aria-pressed={manualPaused}
              aria-label={
                staticMode
                  ? "Signal rail is static; configure speed to enable motion"
                  : manualPaused
                    ? "Resume signal rail"
                    : "Pause signal rail"
              }
              title={
                staticMode
                  ? "Static by default — configure speed to enable motion"
                  : manualPaused
                    ? "Resume signal rail"
                    : "Pause signal rail"
              }
              className={cn(
                controlButtonClassName,
                staticMode && "cursor-not-allowed opacity-45",
              )}
            >
              {manualPaused ? (
                <Play className="h-4 w-4" />
              ) : (
                <Pause className="h-4 w-4" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => setPickerOpen((current) => !current)}
            aria-haspopup="menu"
            aria-expanded={pickerOpen}
            aria-label={`Ticker style: ${activeOption?.label ?? "Original"}`}
            title={`Ticker style: ${activeOption?.label ?? "Original"}`}
            className={controlButtonClassName}
          >
            <Palette className="h-4 w-4" />
          </button>
          {onOpenEditor && (
            <button
              type="button"
              onClick={onOpenEditor}
              aria-label="Configure signal rail"
              title="Configure signal rail"
              className={controlButtonClassName}
            >
              <Settings2 className="h-4 w-4" />
            </button>
          )}

          {pickerOpen && (
            <div
              role="menu"
              aria-label="Choose signal rail style"
              className="absolute right-0 top-[calc(100%+0.75rem)] z-[120] w-[min(25rem,calc(100vw-2rem))] rounded-2xl border   p-2  sui-shadow-overlay ring-1 sui-focus-ring sui-border-weak sui-bg-page sui-color-active"
            >
              <div className="flex items-center justify-between px-2.5 pb-2 pt-1.5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] sui-color-default">
                    Ticker style
                  </p>
                  <p className="mt-0.5 text-xs font-semibold  sui-color-default">
                    Choose a rail treatment
                  </p>
                </div>
                <span className="rounded-full  px-2 py-1 text-xs font-black uppercase tracking-[0.1em]  sui-bg-info sui-color-info">
                  {VARIANT_OPTIONS.length} styles
                </span>
              </div>
              <div className="space-y-1">
                {VARIANT_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={variant === option.id}
                    data-variant-option={option.id}
                    onClick={() => selectVariant(option.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors  focus:outline-none focus-visible:ring-2 sui-focus-visible-ring sui-hover-bg-section",
                      variant === option.id && "sui-bg-info",
                      option.id === "telemetry-constellation" &&
                        "border    sui-border-info sui-bg-info sui-hover-bg-info",
                    )}
                  >
                    <span
                      className={cn(
                        "h-10 w-12 shrink-0 rounded-lg shadow-inner",
                        option.swatchClassName,
                      )}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block sui-color-default font-black uppercase tracking-[0.12em]">
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-xs font-semibold leading-snug  sui-color-default">
                        {option.description}
                      </span>
                    </span>
                    {variant === option.id && (
                      <Check className="h-4 w-4 shrink-0 sui-color-info" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {variant === "bloomberg" && (
        <div className="relative z-10 border-t sui-border-default px-8 py-2 font-mono text-xs font-bold uppercase tracking-[0.18em] sui-color-info">
          Signal Rail · Live · {kpis.length} KPIs Monitored
        </div>
      )}
      {variant === "cisco-blue-gradient" && (
        <div className="relative z-10 border-t sui-border-weak sui-bg-section px-8 py-2 text-xs font-black uppercase tracking-[0.16em] sui-color-muted">
          <span className="mr-2 inline-block h-2 w-2 rounded-full sui-bg-positive sui-shadow-overlay" />
          Signal Rail · Live Feed · All Systems Nominal
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
    </section>
  );
};

export default SignalRailTicker;
