import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styled from "styled-components";
import { DashboardContextProvider } from "@splunk/dashboard-context";
import { DashboardCore } from "@splunk/dashboard-core";
import EnterpriseViewOnlyPreset from "@splunk/dashboard-presets/EnterpriseViewOnlyPreset";
import DotsThreeVertical from "@splunk/react-icons/DotsThreeVertical";
import TimeRangeDropdown from "@splunk/react-time-range/Dropdown";
import Badge from "@splunk/react-ui/Badge";
import Button from "@splunk/react-ui/Button";
import Card from "@splunk/react-ui/Card";
import CardLayout from "@splunk/react-ui/CardLayout";
import Checkbox from "@splunk/react-ui/Checkbox";
import Chip from "@splunk/react-ui/Chip";
import CollapsiblePanel from "@splunk/react-ui/CollapsiblePanel";
import ControlGroup from "@splunk/react-ui/ControlGroup";
import Drawer from "@splunk/react-ui/Drawer";
import Dropdown from "@splunk/react-ui/Dropdown";
import Heading from "@splunk/react-ui/Heading";
import Layout from "@splunk/react-ui/Layout";
import Menu from "@splunk/react-ui/Menu";
import Message from "@splunk/react-ui/Message";
import Modal from "@splunk/react-ui/Modal";
import Multiselect from "@splunk/react-ui/Multiselect";
import Paginator from "@splunk/react-ui/Paginator";
import RadioBar from "@splunk/react-ui/RadioBar";
import SearchInput from "@splunk/react-ui/Search";
import ScreenReaderContent from "@splunk/react-ui/ScreenReaderContent";
import Select from "@splunk/react-ui/Select";
import SpotLight from "@splunk/react-ui/SpotLight";
import StaticContent from "@splunk/react-ui/StaticContent";
import WaitSpinner from "@splunk/react-ui/WaitSpinner";
import { variables } from "@splunk/themes";
import useSplunkTheme from "@splunk/themes/useSplunkTheme";
import {
  Activity,
  RefreshCw,
  Download,
  Keyboard,
  RotateCcw,
  Settings2,
  Edit3,
  Upload,
  X,
  Check,
  CheckCircle2,
  ChevronDown,
  AlertCircle,
  ClipboardCheck,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Search,
  Shield,
  ShieldKeyhole,
  Plus,
  Eye,
  EyeOff,
  Trash2,
  PanelBottom,
  PanelRight,
  PanelRightClose,
  PanelTop,
  Sparkles,
  Globe,
  FingerprintNodes,
  ServerBrackets,
  GlobeDivision,
  ColumnArrowsLeftRight,
  RobotFaceSparkle,
  Servers,
  NodeModel,
  WallBricks,
  RobotFaceWrench,
  Building2,
  Maximize2,
  Minimize2,
  type SuiIcon,
} from "@/common/icons/SuiIcon";
import { useAppThemeControls } from "@/common/theme/AppThemeProvider";
import AppearanceMenuItems from "@/common/components/AppearanceMenuItems";
import { secureNetworkingEssentialsCatalogUrl } from "@/common/lib/appCatalogUrl";
import { buildWorkspaceDrilldownDefinition } from "@/common/lib/dashboardDrilldown";
import { normalizeSharedImageSource } from "@/common/lib/imageSource";
import { DashboardSection } from "@/common/components/workspace/DashboardSection";
import { OneCdRadioBar } from "@/common/components/workspace/OneCdPrimitives";
import { MetricItem } from "@/common/components/workspace/MetricItem";
import { TileActionMenu } from "@/common/components/workspace/TileActionMenu";
import { WorkspaceModalShell } from "@/common/components/workspace/WorkspaceModalShell";
import SearchbaseDrilldownGuidance, {
  type SearchbaseDrilldownMetadata,
} from "@/common/components/workspace/SearchbaseDrilldownGuidance";
import { TableTile } from "@/common/components/workspace/TableTile";
import { BarBreakdownTile } from "@/common/components/workspace/BarBreakdownTile";
import { PieTile } from "@/common/components/workspace/PieTile";
import { SingleValueRadialTile } from "@/common/components/workspace/SingleValueRadialTile";
import { FillerGaugeTile } from "@/common/components/workspace/FillerGaugeTile";
import { MarkerGaugeTile } from "@/common/components/workspace/MarkerGaugeTile";
import {
  sparklineVizTypeFromSplunkViz,
  normalizeDataValuesDisplay,
  type SparklineVizType,
} from "@/common/components/workspace/Sparkline";
import {
  isFillerGaugeViz,
  isMarkerGaugeViz,
  isPieViz,
  isSingleValueRadialViz,
} from "@/common/components/workspace/canvasVizPredicates";
import {
  CustomerTopologyMap,
  clearCustomerTopologyStorage,
  TopologySiteTable,
  usePersistedTopology,
} from "@/common/components/workspace/CustomerTopologyMap";
import { getWorkspaceTopology } from "@/common/config/workspaceTopologies";
import { MANAGER_ROUTED_STUDIO_VIEW_NAMES } from "@/common/config/managedStudioViews";
import {
  DEFAULT_CUSTOMER_TOPOLOGY_SECTION_TITLES,
  type CustomerTopologySectionTitles,
} from "@/common/services/customerTopologyPersistenceService";
import {
  SignalTickerEditor,
  SignalTickerRail,
  type SignalTickerMetricDefaults,
} from "@/common/components/workspace/SignalTickerRail";
import { HelpOverlay } from "@/common/components/workspace/HelpOverlay";
import { InfoTooltip } from "@/common/components/workspace/InfoTooltip";
import {
  KpiPickerPanel,
  type KpiPickerContext,
  type FactoryTileConfigApplyPatch,
} from "@/common/components/workspace/KpiPickerPanel";
import {
  useMetric,
  useKpi,
  useTableData,
  computeStatus,
  isTableViz,
  isBarBreakdownViz,
  deriveThresholdLines,
  type MetricConfig,
  type KpiConfig,
  type SectionId,
  type TimeRange,
  type MetricStatus,
  type MetricThresholds,
} from "@/common/hooks/useMetric";
import { useExportPage } from "@/common/hooks/useExportPage";
import { useKeyboardShortcuts } from "@/common/hooks/useKeyboardShortcuts";
import {
  usePersistedMetricOverrides,
  type MetricOverride,
  type MetricVizOverride,
} from "@/common/hooks/usePersistedMetricOverrides";
import {
  usePersistedSearchbaseDrilldowns,
  type SearchbaseDrilldownMap,
} from "@/common/hooks/usePersistedSearchbaseDrilldowns";
import { usePersistedSectionTileCounts } from "@/common/hooks/usePersistedSectionTileCounts";
import {
  usePersistedSectionTileAdditions,
  type SectionTileAdditionMap,
} from "@/common/hooks/usePersistedSectionTileAdditions";
import { usePersistedSectionHiddenTiles } from "@/common/hooks/usePersistedSectionHiddenTiles";
import { usePersistedSectionLayout } from "@/common/hooks/usePersistedSectionLayout";
import { usePersistedSectionTileOrder } from "@/common/hooks/usePersistedSectionTileOrder";
import { usePersistedSectionHeights } from "@/common/hooks/usePersistedSectionHeights";
import { usePersistedSectionPresentation } from "@/common/hooks/usePersistedSectionPresentation";
import { usePersistedSearchConcurrency } from "@/common/hooks/usePersistedSearchConcurrency";
import timeParser from "../dashboardbuilder/custominput/timeparser";
import {
  getDefaultSignalTickerConfig,
  usePersistedSignalTicker,
  type SignalTickerConfig,
} from "@/common/hooks/usePersistedSignalTicker";
import {
  EXECUTIVE_WORKSPACE_SOURCE_ID,
  PACKAGED_WORKSPACE_FALLBACKS,
  getWorkspaceFromLocation,
  getWorkspaceSectionSource,
  isWorkspaceSourceId,
  readUserScopedStorageItem,
  rememberLastWorkspace,
  sectionIdsForWorkspace,
  toWorkspaceDefinitionInput,
  userScopedStorageKey,
  type InsightsWorkspace,
  type WorkspaceId,
  type WorkspaceSourceId,
  type WorkspaceSectionIcon,
} from "@/common/config/insightsWorkspaces";
import {
  useBrandingOverride,
  readImageAsDataUri,
  BRANDING_LOGO_DATA_URI_MAX_BYTES,
  BRANDING_ACCEPTED_LOGO_MIME_TYPES,
  type BrandingOverride,
} from "@/common/hooks/useBrandingOverride";
import { resolveAppVersions } from "@/common/lib/appVersion";
import { APP_VERSION_LABEL } from "@/common/lib/buildInfo";
import { SortableMetricCard } from "@/common/components/workspace/SortableMetricCard";
import { WorkspaceManager } from "@/common/components/workspace/WorkspaceManager";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  arrayMove,
  horizontalListSortingStrategy,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { runSearch } from "@/common/services/splunkSearchService";
import {
  getSearchbaseCatalogue,
  plainTextFromHtml,
  type SearchbaseRecord,
} from "@/common/services/searchbaseCatalogue";
import {
  loadInsightsWorkspaces,
  resetBuiltInInsightsWorkspace,
  saveInsightsWorkspace,
  saveWorkspaceLayout,
  saveWorkspaceSignalRail,
  type InsightsWorkspaceBundle,
  type WorkspaceLayoutConfig,
} from "@/common/services/insightsWorkspaceService";
import {
  resetInsightsWorkspaceTileConfig,
  saveFactoryTileConfig,
} from "@/common/services/searchbaseTileConfigService";
import { useInsightsWorkspacePermissions } from "@/common/hooks/useInsightsWorkspacePermissions";
import { cn } from "@/common/lib/utils";

// =============================================================================
// Branding
// =============================================================================

const APP_NAME = "splunk-cisco-dashboards";
const WORKSPACE_MENU_WIDTH_PX = 200;
const HEADER_REFRESH_RATE_WIDTH_PX = 140;

// Default subtitle shown beneath the workspace title when no per-user
// override is set in localStorage. Operators can change the visible
// text per-user via the header pencil → Edit branding panel
// (`scd_overview_branding`); this constant only defines the
// out-of-the-box value for fresh deployments.
const DEFAULT_HEADER_SUBTITLE = "Splunk Secure Networking Essentials";
const DEFAULT_HEADER_TITLE_FALLBACK = "Your Organization Name";
const DEFAULT_LOGO_DATA_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ' +
      'stroke="white" stroke-width="1.8" stroke-linecap="round" ' +
      'stroke-linejoin="round"><circle cx="12" cy="12" r="2.25"/>' +
      '<circle cx="5.5" cy="7" r="1.65"/><circle cx="18.5" cy="7" r="1.65"/>' +
      '<circle cx="5.5" cy="17" r="1.65"/><circle cx="18.5" cy="17" r="1.65"/>' +
      '<path d="M7 8.2 10.2 10.7M16.9 8.2 13.8 10.7M7 15.8 10.2 13.3M16.9 15.8 13.8 13.3"/>' +
      '<path d="M4 12h3M17 12h3"/></svg>',
  );

const splunkLocalePrefix = (): string => {
  if (typeof window === "undefined") return "/en-US";
  const match = window.location.pathname.match(
    /^\/([a-z]{2}-[A-Z]{2})(?:\/|$)/,
  );
  return `/${match ? match[1] : "en-US"}`;
};

const MIN_DASHBOARD_HEIGHT_PX = 520;
const COMPACT_HEIGHT_THRESHOLD_PX = 720;
const SECTION_HEIGHT_BASE_PX = 180;
const SECTION_HEIGHT_COMPACT_BASE_PX = 174;
const SECTION_HEIGHT_H1_BASE_PX = 152;
const SECTION_HEIGHT_STEP_PX = 120;
// Wrapped sections need to budget for the full card floor plus the
// inter-row gap. 152px matched the bare tile min-height too closely and
// caused the third row to be clipped at H1 when a section showed 9 tiles.
const SECTION_WRAPPED_TILE_ROW_STEP_PX = 176;
const SECTION_WRAPPED_H1_TILE_ROW_STEP_PX = 148;
const SECTION_WRAP_TILE_COUNT = 4;
const SECTION_WRAPPED_TILE_COLUMNS = 3;
const VERTICAL_MAP_MIN_HEIGHT_PX = 420;
const VERTICAL_MAP_COMPACT_MIN_HEIGHT_PX = 360;
const VERTICAL_METRICS_MIN_HEIGHT_PX = 220;
const VERTICAL_METRICS_COMPACT_MIN_HEIGHT_PX = 180;
const VERTICAL_SPLIT_CHROME_ALLOWANCE_PX = 32;

const meaningfulTilePageCount = (
  total: number,
  pageSize: number,
  minimumPageSize: number,
): number => {
  if (pageSize <= 0 || total <= pageSize) return 1;
  const fullPages = Math.floor(total / pageSize);
  const remainder = total % pageSize;
  return Math.max(1, fullPages + (remainder >= minimumPageSize ? 1 : 0));
};

const useAvailableDashboardHeight = (): number | null => {
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return undefined;

    let animationFrame = 0;
    let cancelled = false;

    const measure = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        if (cancelled) return;
        const mount = document.getElementById("scan-root");
        const top = mount?.getBoundingClientRect().top ?? 0;
        const next = Math.max(
          MIN_DASHBOARD_HEIGHT_PX,
          Math.floor(window.innerHeight - Math.max(top, 0)),
        );
        setHeight((current) =>
          current !== null && Math.abs(current - next) < 2 ? current : next,
        );
      });
    };

    // The shell height we write back lives *inside* document.body
    // and #scan-root's parent, so observing those elements with a
    // ResizeObserver turns every height write into a fresh resize
    // notification — a self-referential measure→resize→measure
    // cycle that visibly flickers whenever a scrollbar toggles or
    // chrome above the mount reflows (the guard below only damps
    // it, it doesn't stop it). The shell height is a pure function
    // of the viewport height and the mount's top offset, both of
    // which change on window resize / rotation, not on our own
    // writes — so a resize listener is sufficient and loop-free.
    // The delayed re-measures catch Splunk's app chrome (nav bar)
    // settling asynchronously after first paint, which is the one
    // legitimate post-mount `top` shift the ResizeObserver used to
    // absorb.
    measure();
    const settleTimers = [
      window.setTimeout(measure, 250),
      window.setTimeout(measure, 1000),
    ];
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animationFrame);
      settleTimers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);

  return height;
};

// =============================================================================
// Time range
// =============================================================================

const TIME_RANGE_OPTIONS: TimeRange[] = [
  {
    earliest: "-4h@h",
    latest: "now",
    label: "Last 4 hours",
    spanSeconds: 4 * 3600,
  },
  {
    earliest: "-24h@h",
    latest: "now",
    label: "Last 24 hours",
    spanSeconds: 24 * 3600,
  },
  {
    earliest: "-48h@h",
    latest: "now",
    label: "Last 48 hours",
    spanSeconds: 48 * 3600,
  },
  {
    earliest: "-7d@d",
    latest: "now",
    label: "Last 7 days",
    spanSeconds: 7 * 86400,
  },
  {
    earliest: "-30d@d",
    latest: "now",
    label: "Last 30 days",
    spanSeconds: 30 * 86400,
  },
];
const DEFAULT_TIME_RANGE_LABEL = "Last 24 hours";
const TIME_RANGE_PRESETS = [
  { label: "Today", earliest: "@d", latest: "now" },
  { label: "Week to date", earliest: "@w0", latest: "now" },
  { label: "Business week to date", earliest: "@w1", latest: "now" },
  { label: "Month to date", earliest: "@mon", latest: "now" },
  { label: "Year to date", earliest: "@y", latest: "now" },
  { label: "Yesterday", earliest: "-1d@d", latest: "@d" },
  { label: "Previous week", earliest: "-7d@w0", latest: "@w0" },
  {
    label: "Previous business week",
    earliest: "-6d@w1",
    latest: "-1d@w6",
  },
  { label: "Previous month", earliest: "-1mon@mon", latest: "@mon" },
  { label: "Previous year", earliest: "-1y@y", latest: "@y" },
  { label: "Last 15 minutes", earliest: "-15m", latest: "now" },
  { label: "Last 60 minutes", earliest: "-60m@m", latest: "now" },
  { label: "Last 4 hours", earliest: "-4h@m", latest: "now" },
  { label: "Last 24 hours", earliest: "-24h@h", latest: "now" },
  { label: "Last 7 days", earliest: "-7d@h", latest: "now" },
  { label: "Last 30 days", earliest: "-30d@d", latest: "now" },
  { label: "All time", earliest: "0", latest: "" },
  // Keep the existing workspace shortcut available in the native preset panel.
  { label: "Last 48 hours", earliest: "-48h@h", latest: "now" },
] as const;

interface TimeRangeChange {
  earliest?: string | null;
  latest?: string | null;
}

interface TimeParseResult {
  error?: Record<string, unknown>;
  iso?: string;
  time?: string;
  displayValue?: string;
}

const normalizeTimeParseResult = (
  result: TimeParseResult,
  fallbackTime: string,
): TimeParseResult => ({
  error: result.error
    ? { message: String(result.error.message || result.error) }
    : undefined,
  iso: result.iso,
  time: result.time || fallbackTime,
  displayValue: result.displayValue,
});

const useTimeRangeParser = (): {
  parseEarliest: TimeParseResult | undefined;
  parseLatest: TimeParseResult | undefined;
  handleRequestParseEarliest: (time: string) => void;
  handleRequestParseLatest: (time: string) => void;
} => {
  const [parseEarliest, setParseEarliest] = useState<TimeParseResult>();
  const [parseLatest, setParseLatest] = useState<TimeParseResult>();
  const mountedRef = useRef(true);
  const earliestRequestRef = useRef(0);
  const latestRequestRef = useRef(0);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const handleRequestParseEarliest = useCallback((time: string) => {
    const requestId = earliestRequestRef.current + 1;
    earliestRequestRef.current = requestId;
    void timeParser(time, "en_US")
      .then((result: TimeParseResult) => {
        if (mountedRef.current && requestId === earliestRequestRef.current) {
          setParseEarliest(normalizeTimeParseResult(result, time));
        }
      })
      .catch(() => {
        if (mountedRef.current && requestId === earliestRequestRef.current) {
          setParseEarliest({
            error: { message: "The time string could not be parsed" },
            time,
          });
        }
      });
  }, []);

  const handleRequestParseLatest = useCallback((time: string) => {
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;
    void timeParser(time || "now", "en_US")
      .then((result: TimeParseResult) => {
        if (mountedRef.current && requestId === latestRequestRef.current) {
          setParseLatest(normalizeTimeParseResult(result, time));
        }
      })
      .catch(() => {
        if (mountedRef.current && requestId === latestRequestRef.current) {
          setParseLatest({
            error: { message: "The time string could not be parsed" },
            time,
          });
        }
      });
  }, []);

  return {
    parseEarliest,
    parseLatest,
    handleRequestParseEarliest,
    handleRequestParseLatest,
  };
};

const relativeRangeSpanSeconds = (
  earliest: string,
  fallback: number,
): number => {
  const match = earliest.trim().match(
  /^-(\d+(?:\.\d+)?)(s|m|h|d|w|mon|qtr|y)(?:@[A-Za-z0-9]+)?$/i,
  );
  if (!match) return fallback;
  const unitSeconds: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
    w: 604800,
    mon: 30 * 86400,
    qtr: 90 * 86400,
    y: 365 * 86400,
  };
  return Math.max(1, Math.round(Number(match[1]) * unitSeconds[match[2].toLowerCase()]));
};

const spanSecondsForTimeRange = (
  earliest: string,
  latest: string,
  fallback: number,
): number => {
  const start = new Date(earliest).getTime();
  const end = new Date(latest).getTime();
  if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
    return Math.max(1, Math.round((end - start) / 1000));
  }
  return relativeRangeSpanSeconds(earliest, fallback);
};

const timeRangeFromChange = (
  current: TimeRange,
  data?: TimeRangeChange,
): TimeRange => {
  const earliest = data?.earliest ?? current.earliest;
  const latest = data?.latest ?? current.latest;
  const preset = TIME_RANGE_OPTIONS.find(
    (option) => option.earliest === earliest && option.latest === latest,
  );
  if (preset) return preset;
  const nativePreset = TIME_RANGE_PRESETS.find(
    (option) => option.earliest === earliest && option.latest === latest,
  );
  return {
    earliest,
    latest,
    label: nativePreset?.label ?? "Custom range",
    spanSeconds: spanSecondsForTimeRange(
      earliest,
      latest,
      current.spanSeconds,
    ),
  };
};

interface TimeRangeControlProps {
  range: TimeRange;
  onChange: (range: TimeRange) => void;
}

const TimeRangeControl: React.FC<TimeRangeControlProps> = ({
  range,
  onChange,
}) => {
  const timeRangeParser = useTimeRangeParser();
  const handleChange = useCallback(
    (_event: React.SyntheticEvent, data?: TimeRangeChange): void => {
      onChange(timeRangeFromChange(range, data));
    },
    [onChange, range],
  );

  return (
    <TimeRangeDropdown
      aria-label="Dashboard time range"
      earliest={range.earliest}
      inline
      latest={range.latest}
      labelMaxChars={30}
      onChange={handleChange}
      onRequestParseEarliest={timeRangeParser.handleRequestParseEarliest}
      onRequestParseLatest={timeRangeParser.handleRequestParseLatest}
      parseEarliest={timeRangeParser.parseEarliest}
      parseLatest={timeRangeParser.parseLatest}
      presets={[...TIME_RANGE_PRESETS]}
      realTimeDisabled
    />
  );
};

// =============================================================================
// Auto-refresh
// =============================================================================

const AUTO_REFRESH_OPTIONS: { label: string; seconds: number }[] = [
  { label: "Off", seconds: 0 },
  { label: "30 s", seconds: 30 },
  { label: "1 m", seconds: 60 },
  { label: "5 m", seconds: 300 },
  { label: "15 m", seconds: 900 },
];

// =============================================================================
// Overview searchbase metadata
// =============================================================================
//
// Factory Overview tiles are authored in `default/searchbase.conf` under
// `viz_options.overview`. This page intentionally does not carry a parallel
// tile catalogue; until the searchbase catalogue loads, the tile roster is
// empty. Once loaded, searchbase.conf is the source for label, section, value
// fields, thresholds, mock fallback, SPL, and dispatch context.

const DEFAULT_OVERVIEW_MOCK: MetricConfig["mock"] = {
  seed: 1,
  sparkMin: 0,
  sparkMax: 0,
  value: 0,
  change: 0,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const readOverviewString = (
  source: Record<string, unknown>,
  key: string,
  maxLength = 512,
): string | undefined => {
  const raw = source[key];
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength
    ? trimmed
    : undefined;
};

const readOverviewNumber = (
  source: Record<string, unknown>,
  key: string,
): number | undefined => {
  const raw = source[key];
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : undefined;
  if (typeof raw !== "string") return undefined;
  const parsed = Number(raw.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
};

const readOverviewBoolean = (
  source: Record<string, unknown>,
  key: string,
): boolean | undefined => {
  const raw = source[key];
  if (typeof raw === "boolean") return raw;
  if (typeof raw !== "string") return undefined;
  if (/^(1|true|yes)$/i.test(raw.trim())) return true;
  if (/^(0|false|no)$/i.test(raw.trim())) return false;
  return undefined;
};

const readFirstSeriesColor = (
  options: Record<string, unknown> | undefined,
): string | undefined => {
  const seriesColors = options?.seriesColors;
  if (!Array.isArray(seriesColors)) return undefined;
  const first = seriesColors.find(
    (value): value is string =>
      typeof value === "string" && /^#[0-9a-f]{3,8}$/i.test(value.trim()),
  );
  return first?.trim();
};

const parseWorkspaceSource = (raw: unknown): WorkspaceSourceId => {
  if (typeof raw !== "string") return EXECUTIVE_WORKSPACE_SOURCE_ID;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "overview" || trimmed === "default") {
    return EXECUTIVE_WORKSPACE_SOURCE_ID;
  }
  return isWorkspaceSourceId(trimmed) ? trimmed : EXECUTIVE_WORKSPACE_SOURCE_ID;
};

const parseOverviewSection = (
  raw: unknown,
  profile: InsightsWorkspace,
): SectionId | undefined => {
  if (typeof raw !== "string") return undefined;
  const candidate = raw.trim() as SectionId;
  return sectionIdsForWorkspace(profile).includes(candidate)
    ? candidate
    : undefined;
};

const overviewDefinitionMatchesWorkspace = (
  definition: Record<string, unknown>,
  profile: InsightsWorkspace,
): boolean => {
  const section = parseOverviewSection(definition.section, profile);
  if (!section) return false;
  return (
    parseWorkspaceSource(definition.workspace ?? definition.profile) ===
    getWorkspaceSectionSource(section)
  );
};

const parseOverviewThresholds = (
  raw: unknown,
  fallback?: MetricThresholds,
): MetricThresholds | undefined => {
  if (!isRecord(raw)) return fallback;
  const enabled = readOverviewBoolean(raw, "enabled");
  const warning = readOverviewNumber(raw, "warning");
  const critical = readOverviewNumber(raw, "critical");
  const directionRaw = readOverviewString(raw, "direction", 32);
  const direction =
    directionRaw === "lower_is_better" || directionRaw === "higher_is_better"
      ? directionRaw
      : fallback?.direction;
  if (
    enabled === undefined &&
    warning === undefined &&
    critical === undefined &&
    !direction
  )
    return fallback;
  return {
    enabled: enabled ?? fallback?.enabled,
    warning: warning ?? fallback?.warning,
    critical: critical ?? fallback?.critical,
    direction: direction ?? "higher_is_better",
  };
};

const parseOverviewMock = (
  raw: unknown,
  fallback?: MetricConfig["mock"],
): MetricConfig["mock"] => {
  if (!isRecord(raw)) return fallback ?? DEFAULT_OVERVIEW_MOCK;
  return {
    seed:
      readOverviewNumber(raw, "seed") ??
      fallback?.seed ??
      DEFAULT_OVERVIEW_MOCK.seed,
    sparkMin:
      readOverviewNumber(raw, "sparkMin") ??
      fallback?.sparkMin ??
      DEFAULT_OVERVIEW_MOCK.sparkMin,
    sparkMax:
      readOverviewNumber(raw, "sparkMax") ??
      fallback?.sparkMax ??
      DEFAULT_OVERVIEW_MOCK.sparkMax,
    value:
      readOverviewNumber(raw, "value") ??
      fallback?.value ??
      DEFAULT_OVERVIEW_MOCK.value,
    change:
      readOverviewNumber(raw, "change") ??
      fallback?.change ??
      DEFAULT_OVERVIEW_MOCK.change,
  };
};

const overviewDefinitionsFromRecord = (
  record: SearchbaseRecord,
): Record<string, unknown>[] => {
  const raw = record.vizOptions?.overview;
  if (Array.isArray(raw)) return raw.filter(isRecord);
  return isRecord(raw) ? [raw] : [];
};

const slugifyOverviewId = (raw: string): string =>
  raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);

const discoverProfileDefinitionFromRecord = (
  record: SearchbaseRecord,
  profile: InsightsWorkspace,
): Record<string, unknown> | null => {
  const auto = profile.autoDiscovery;
  if (!auto) return null;
  if (auto.stanzaPrefix && !record.id.startsWith(auto.stanzaPrefix)) {
    return null;
  }
  if (
    auto.requiredTag &&
    !record.tags.some(
      (tag) => tag.toLowerCase() === auto.requiredTag?.toLowerCase(),
    )
  ) {
    return null;
  }
  const section = record.subCategory
    ? auto.subCategoryToSection[record.subCategory]
    : undefined;
  if (!section) return null;
  return {
    workspace: profile.sourceWorkspace,
    tileId: slugifyOverviewId(record.id),
    section,
    label: record.searchName.replace(/^Secure Networking\s*-\s*/i, ""),
    subLabel: record.category ?? record.subCategory,
  };
};

interface OverviewMetricBuildOptions {
  tileId?: string;
  section?: SectionId;
  searchbaseId?: string;
  suppressMockOnEmpty?: boolean;
}

const buildOverviewDescription = (
  record: SearchbaseRecord,
  definition: Record<string, unknown>,
): string | undefined => {
  const explicit = readOverviewString(definition, "description", 4000);
  const summary =
    explicit ??
    plainTextFromHtml(record.description) ??
    plainTextFromHtml(record.explanation) ??
    plainTextFromHtml(record.solution);

  // Hover/focus help is deliberately a concise summary. Clicking the same
  // parent-tile info control reveals the remaining parent Searchbase metadata;
  // the separate detail-table control remains exclusively for drill-downs.
  return summary?.replace(/\s+/g, " ").trim() || undefined;
};

const buildOverviewInfoSections = (
  record: SearchbaseRecord,
): readonly { title: string; content: string }[] =>
  [
    { title: "Explanation", content: plainTextFromHtml(record.explanation) },
    { title: "Operator action", content: plainTextFromHtml(record.solution) },
    {
      title: "Related information",
      content: plainTextFromHtml(record.relatedInfo),
    },
    { title: "Execution plan", content: plainTextFromHtml(record.executionPlan) },
  ].filter(
    (section): section is { title: string; content: string } =>
      Boolean(section.content?.trim()),
  );

const buildOverviewMetricFromDefinition = (
  record: SearchbaseRecord,
  definition: Record<string, unknown>,
  profile: InsightsWorkspace,
  options: OverviewMetricBuildOptions = {},
): MetricConfig | null => {
  const id = options.tileId ?? readOverviewString(definition, "tileId", 128);
  const section =
    options.section ?? parseOverviewSection(definition.section, profile);
  if (!id || !section) return null;

  const description = buildOverviewDescription(record, definition);
  const color =
    readOverviewString(definition, "color", 32) ??
    readFirstSeriesColor(record.vizOptions);
  const comparePeriod = readOverviewBoolean(definition, "comparePeriod");

  return {
    id,
    section,
    label: readOverviewString(definition, "label", 160) ?? record.searchName,
    subLabel:
      readOverviewString(definition, "subLabel", 160) ??
      record.subCategory ??
      record.category,
    description,
    infoSections: buildOverviewInfoSections(record),
    searchbaseId: options.searchbaseId ?? record.id,
    savedSearch: record.searchName,
    spl: undefined,
    dispatchContext: record.dispatchContext,
    valueField: readOverviewString(definition, "valueField", 160),
    changeField: readOverviewString(definition, "changeField", 160),
    displayField: readOverviewString(definition, "displayField", 160),
    sparkDataField: readOverviewString(definition, "sparkDataField", 160),
    baselineField: readOverviewString(definition, "baselineField", 160),
    overlayLabel: readOverviewString(definition, "overlayLabel", 80),
    comparePeriod,
    unit: readOverviewString(definition, "unit", 32),
    color,
    thresholds: parseOverviewThresholds(definition.thresholds),
    thresholdNote: readOverviewString(definition, "thresholdNote", 2000),
    suppressMockOnEmpty: options.suppressMockOnEmpty ? true : undefined,
    mock: parseOverviewMock(definition.mock),
  };
};

const buildOverviewMetricConfig = (
  records: SearchbaseRecord[] | null,
  profile: InsightsWorkspace,
): MetricConfig[] => {
  if (records === null) return [];

  const discovered = new Map<string, MetricConfig>();

  for (const record of records) {
    if (!record.searchName || !record.search) continue;
    const definitions = overviewDefinitionsFromRecord(record).filter(
      (definition) => overviewDefinitionMatchesWorkspace(definition, profile),
    );
    const autoDefinition =
      definitions.length === 0
        ? discoverProfileDefinitionFromRecord(record, profile)
        : null;
    for (const definition of autoDefinition
      ? [...definitions, autoDefinition]
      : definitions) {
      const metric = buildOverviewMetricFromDefinition(
        record,
        definition,
        profile,
        {
          // Factory workspaces must never disguise an empty live search as
          // synthetic telemetry.  Added tiles already use this contract;
          // applying it here keeps every workspace tile honest and makes the
          // existing no-data reason visible to the operator.
          suppressMockOnEmpty: true,
        },
      );
      if (!metric || discovered.has(metric.id)) continue;
      discovered.set(metric.id, metric);
    }
  }

  return Array.from(discovered.values());
};

const shortStableHash = (raw: string): string => {
  let hash = 5381;
  for (let i = 0; i < raw.length; i += 1) {
    hash = ((hash * 33) ^ raw.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36).slice(0, 7);
};

const SEARCHBASE_RECORD_REFERENCE_SEPARATOR = "::";

const searchbaseRecordReference = (record: SearchbaseRecord): string =>
  `${record.ownerApp}${SEARCHBASE_RECORD_REFERENCE_SEPARATOR}${record.id}`;

const searchbaseRecordReferenceFromParts = (
  ownerApp: string,
  recordId: string,
): string => `${ownerApp}${SEARCHBASE_RECORD_REFERENCE_SEPARATOR}${recordId}`;

const searchbaseRecordNameReference = (
  ownerApp: string,
  searchName: string,
): string => `${ownerApp}${SEARCHBASE_RECORD_REFERENCE_SEPARATOR}${searchName}`;

const searchbaseReferenceMatchesRecord = (
  reference: string | undefined,
  record: SearchbaseRecord,
  currentAppOwner: string,
): boolean =>
  reference === searchbaseRecordReference(record) ||
  (record.ownerApp === currentAppOwner && reference === record.id);

const searchbaseReferenceSetHasRecord = (
  references: ReadonlySet<string>,
  record: SearchbaseRecord,
  currentAppOwner: string,
): boolean =>
  references.has(searchbaseRecordReference(record)) ||
  (record.ownerApp === currentAppOwner && references.has(record.id));

const overviewAdditionTileId = (
  section: SectionId,
  searchbaseId: string,
): string => {
  const sectionSlug = slugifyOverviewId(section).slice(0, 24) || "section";
  const hash = shortStableHash(`${section}:${searchbaseId}`);
  const prefix = `add_${sectionSlug}_`;
  const suffix = `_${hash}`;
  const maxRecordSlugLength = Math.max(8, 64 - prefix.length - suffix.length);
  const recordSlug =
    slugifyOverviewId(searchbaseId).slice(0, maxRecordSlugLength) || "search";
  return `${prefix}${recordSlug}${suffix}`;
};

const buildAddedOverviewMetricConfig = (
  currentAppRecords: SearchbaseRecord[] | null,
  catalogueRecords: SearchbaseRecord[] | null,
  additions: SectionTileAdditionMap,
  profile: InsightsWorkspace,
  existingMetrics: MetricConfig[],
): MetricConfig[] => {
  if (currentAppRecords === null || catalogueRecords === null) return [];

  const currentAppRecordsById = new Map(
    currentAppRecords.map((record) => [record.id, record]),
  );
  const recordsByReference = new Map(
    catalogueRecords.map((record) => [
      searchbaseRecordReference(record),
      record,
    ]),
  );
  const existingIds = new Set(existingMetrics.map((metric) => metric.id));
  const existingSearchesBySection = new Set(
    existingMetrics
      .filter((metric) => metric.searchbaseId)
      .map((metric) => {
        const searchbaseId = metric.searchbaseId as string;
        const currentRecord = currentAppRecordsById.get(searchbaseId);
        const reference = currentRecord
          ? searchbaseRecordReference(currentRecord)
          : searchbaseId;
        return `${metric.section}:${reference}`;
      }),
  );
  const out: MetricConfig[] = [];

  for (const section of sectionIdsForWorkspace(profile)) {
    const searchbaseReferences = additions[section] ?? [];
    for (const searchbaseReference of searchbaseReferences) {
      const record =
        recordsByReference.get(searchbaseReference) ??
        currentAppRecordsById.get(searchbaseReference);
      if (!record?.searchName || !record.search) continue;
      const canonicalReference = searchbaseRecordReference(record);
      if (existingSearchesBySection.has(`${section}:${canonicalReference}`)) {
        continue;
      }
      const tileId = overviewAdditionTileId(section, searchbaseReference);
      if (existingIds.has(tileId)) continue;

      const definitions = overviewDefinitionsFromRecord(record).filter(
        (definition) => overviewDefinitionMatchesWorkspace(definition, profile),
      );
      const autoDefinition =
        definitions.length === 0
          ? discoverProfileDefinitionFromRecord(record, profile)
          : null;
      const definition = definitions[0] ?? autoDefinition ?? {};
      const metric = buildOverviewMetricFromDefinition(
        record,
        definition,
        profile,
        {
          tileId,
          section,
          searchbaseId: searchbaseReference,
          suppressMockOnEmpty: true,
        },
      );
      if (!metric) continue;
      out.push(metric);
      existingIds.add(tileId);
      existingSearchesBySection.add(`${section}:${canonicalReference}`);
    }
  }

  return out;
};

const MAP_FOOTER_SLOTS = ["primary", "secondary"] as const;
type MapFooterSlot = (typeof MAP_FOOTER_SLOTS)[number];
type MapFooterKpiConfig = KpiConfig & {
  slot: MapFooterSlot;
  thresholds?: MetricThresholds;
};

const DISABLED_MAP_FOOTER_KPI_CONFIG: MapFooterKpiConfig = {
  id: "__map_footer_unavailable",
  slot: "primary",
  label: "",
  valueField: "value",
  mockValue: "",
};

const isMapFooterSlot = (value: unknown): value is MapFooterSlot =>
  typeof value === "string" &&
  (MAP_FOOTER_SLOTS as readonly string[]).includes(value.trim());

const buildOverviewMapFooterConfig = (
  records: SearchbaseRecord[] | null,
): MapFooterKpiConfig[] => {
  if (records === null) return [];

  const discovered = new Map<MapFooterSlot, MapFooterKpiConfig>();

  for (const record of records) {
    if (!record.searchName || !record.search) continue;
    const raw = record.vizOptions?.mapFooter;
    if (!isRecord(raw)) continue;
    const rawSlot = typeof raw.slot === "string" ? raw.slot.trim() : "";
    if (!isMapFooterSlot(rawSlot)) continue;
    const slot = rawSlot;
    if (discovered.has(slot)) continue;

    const id = readOverviewString(raw, "id", 128) ?? `map_${slot}`;
    discovered.set(slot, {
      id,
      slot,
      searchbaseId: record.id,
      savedSearch: record.searchName,
      spl: undefined,
      dispatchContext: record.dispatchContext,
      label: readOverviewString(raw, "label", 160) ?? record.searchName,
      description:
        readOverviewString(raw, "description", 2000) ??
        plainTextFromHtml(record.explanation) ??
        plainTextFromHtml(record.description),
      valueField: readOverviewString(raw, "valueField", 160),
      unit: readOverviewString(raw, "unit", 32),
      mockValue: readOverviewString(raw, "mockValue", 120) ?? "Loading...",
      thresholdNote: readOverviewString(raw, "thresholdNote", 2000),
      thresholds: parseOverviewThresholds(raw.thresholds),
    });
  }

  return MAP_FOOTER_SLOTS.map((slot) => discovered.get(slot)).filter(
    (item): item is MapFooterKpiConfig => Boolean(item),
  );
};

const mapFooterStatus = (
  value: string,
  thresholds?: MetricThresholds,
): MetricStatus => {
  const numericValue = Number.parseFloat(value.replace(/,/g, ""));
  return computeStatus(numericValue, thresholds);
};

// =============================================================================
// Section icon rendering
// =============================================================================

const SECTION_ICON_COMPONENTS: Record<WorkspaceSectionIcon, SuiIcon> = {
  activity: Activity,
  shield: Shield,
  building: Building2,
  sparkles: Sparkles,
  "shield-keyhole": ShieldKeyhole,
  servers: Servers,
  "node-model": NodeModel,
  "wall-bricks": WallBricks,
  "robot-face-wrench": RobotFaceWrench,
  "fingerprint-nodes": FingerprintNodes,
  "server-brackets": ServerBrackets,
  "globe-division": GlobeDivision,
  "column-arrows-left-right": ColumnArrowsLeftRight,
  "robot-face-sparkle": RobotFaceSparkle,
  "shield-check": ShieldKeyhole,
  "server-cog": Servers,
  network: NodeModel,
  firewall: WallBricks,
  globe: Globe,
  bot: RobotFaceWrench,
};

// Cisco's technical SVGs are authored for much larger canvases, where their
// thin strokes read well. At this compact dashboard size those strokes land
// below one CSS pixel and look faint even though the source remains perfectly
// sharp. Layering the same vector mask at sub-pixel offsets gives the icons an
// optical small-size weight without rasterizing or altering the official art.
const SECTION_ICON_MASK_OFFSETS = [
  [0, 0],
  [0.5, 0],
  [-0.5, 0],
  [0, 0.5],
  [0, -0.5],
] as const;

interface AppPriorityDrilldown {
  viewName: string;
  title: string;
  description: string;
  timeToken?: string;
}

const PRIORITY_DRILLDOWN_LABEL = "Priority Drill-Down";
const PRIORITY_DRILLDOWN_CTA = "Open dashboard";
const PRIORITY_DRILLDOWN_STORAGE_KEY =
  "splunk-cisco-dashboards.priorityDrilldown.v1";
const DEFAULT_PRIORITY_DRILLDOWN_VIEW = "netops_catalyst_health";

// App-local allow-list only. These are shipped views in this app, curated
// from default/data/ui/nav/default.xml plus default/data/ui/views/*.xml.
// Archive, overview, test, template, admin, and platform utility views are
// intentionally excluded from the executive drill-down picker.
const APP_PRIORITY_DRILLDOWNS: readonly AppPriorityDrilldown[] = [
  {
    viewName: "netops_catalyst_health",
    title: "Enterprise Network Operations Report",
    description:
      "Client health, readiness, and operations signals across all sites.",
    timeToken: "time_tok",
  },
  {
    viewName: "netops_critical_systems_health",
    title: "IT Health",
    description:
      "Critical systems, network posture, device health, and compliance.",
    timeToken: "global_time",
  },
  {
    viewName: "secops_resilience",
    title: "Security Resilience",
    description: "Firewall, identity, XDR, IDS/IPS, DNS, and endpoint signals.",
    timeToken: "global_time",
  },
  {
    viewName: "workplace_building_intelligence",
    title: "Building Intelligence",
    description:
      "Cisco Spaces occupancy, wireless trust, and workplace telemetry.",
    timeToken: "global_time",
  },
  {
    viewName: "netops_health_monitoring",
    title: "Health Monitoring",
    description: "Operational health monitoring for sites and infrastructure.",
  },
  {
    viewName: "netops_readiness",
    title: "NetOps Readiness",
    description: "Readiness, site posture, and field-operation validation.",
    timeToken: "global_time",
  },
  {
    viewName: "workplace_spaces_intelligence",
    title: "Spaces Intelligence",
    description:
      "Cisco Spaces intelligence for locations, devices, and activity.",
    timeToken: "global_time",
  },
  {
    viewName: "workplace_operations_overview",
    title: "Workplace Single Pane",
    description: "Unified workplace and collaboration operating view.",
    timeToken: "global_time",
  },
  {
    viewName: "admin_asset_inventory",
    title: "Asset Inventory",
    description: "Asset inventory across Cisco and Splunk-connected sources.",
    timeToken: "time_tok",
  },
  {
    viewName: "network_diagram",
    title: "Network Diagram",
    description: "Network diagram and topology-oriented operational context.",
  },
  {
    viewName: "sn_topology_canvas",
    title: "Topology Canvas",
    description:
      "Interactive network topology canvas for site and device context.",
  },
];

const getPriorityDrilldown = (viewName: string): AppPriorityDrilldown =>
  APP_PRIORITY_DRILLDOWNS.find((item) => item.viewName === viewName) ??
  APP_PRIORITY_DRILLDOWNS[0];

const readPriorityDrilldownView = (): string => {
  if (typeof window === "undefined" || !window.localStorage) {
    return DEFAULT_PRIORITY_DRILLDOWN_VIEW;
  }
  try {
    const raw = readUserScopedStorageItem(
      userScopedStorageKey(PRIORITY_DRILLDOWN_STORAGE_KEY),
    );
    if (!raw) return DEFAULT_PRIORITY_DRILLDOWN_VIEW;
    const parsed = JSON.parse(raw) as { viewName?: unknown };
    const viewName = typeof parsed.viewName === "string" ? parsed.viewName : "";
    return getPriorityDrilldown(viewName).viewName;
  } catch {
    return DEFAULT_PRIORITY_DRILLDOWN_VIEW;
  }
};

const writePriorityDrilldownView = (viewName: string): void => {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      userScopedStorageKey(PRIORITY_DRILLDOWN_STORAGE_KEY),
      JSON.stringify({ viewName }),
    );
  } catch {
    // Storage may be unavailable; the in-memory state still works
    // for the current session.
  }
};

const clearPriorityDrilldownView = (): void => {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.removeItem(
      userScopedStorageKey(PRIORITY_DRILLDOWN_STORAGE_KEY),
    );
  } catch {
    // Storage unavailable; ignore.
  }
};

// =============================================================================
// Splunk Search drilldown URL builder
// =============================================================================

// Locale-aware URL builder for a sibling Splunk view inside this app. Mirrors
// splunkSearchAppUrl's locale detection so the URL stays valid in non-en-US
// Splunk installs.
const splunkViewAppUrl = (
  viewName: string,
  range?: TimeRange,
  timeToken?: string,
): string => {
  const path =
    typeof window !== "undefined" ? window.location.pathname : "/en-US";
  const localeMatch = path.match(/^\/([a-z]{2}-[A-Z]{2})\//);
  const locale = localeMatch ? localeMatch[1] : "en-US";
  const isManagedStudioView = MANAGER_ROUTED_STUDIO_VIEW_NAMES.has(viewName);
  const baseUrl = `/${locale}/app/${APP_NAME}/${
    isManagedStudioView ? "dashboard_manager" : viewName
  }`;
  const routeHash = isManagedStudioView ? `#/${viewName}` : "";
  if (!range || !timeToken) return `${baseUrl}${routeHash}`;

  const params = new URLSearchParams();
  params.set(`form.${timeToken}.earliest`, range.earliest);
  params.set(`form.${timeToken}.latest`, range.latest);
  return `${baseUrl}?${params.toString()}${routeHash}`;
};

const SEARCH_APP_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_\-.]{0,127}$/;

const resolveSearchAppName = (appName?: string): string =>
  appName && SEARCH_APP_NAME_PATTERN.test(appName) ? appName : APP_NAME;

const splunkSearchAppUrl = (
  spl: string,
  range: TimeRange,
  appName?: string,
): string => {
  // Open the stock Splunk search bar under the same app namespace used
  // for dispatch. The platform `search` view is exported system-wide,
  // so navigating to /app/<any-app>/search renders Search & Reporting
  // while resolving macros/data models in that app context.
  const path =
    typeof window !== "undefined" ? window.location.pathname : "/en-US";
  const localeMatch = path.match(/^\/([a-z]{2}-[A-Z]{2})\//);
  const locale = localeMatch ? localeMatch[1] : "en-US";
  const params = new URLSearchParams({
    q: spl,
    earliest: range.earliest,
    latest: range.latest,
  });
  return `/${locale}/app/${resolveSearchAppName(appName)}/search?${params.toString()}`;
};

const splunkSearchbaseEditUrl = (stanzaId: string): string => {
  const path =
    typeof window !== "undefined" ? window.location.pathname : "/en-US";
  const localeMatch = path.match(/^\/([a-z]{2}-[A-Z]{2})\//);
  const locale = localeMatch ? localeMatch[1] : "en-US";
  return `/${locale}/app/searchbase/start#/edit/${encodeURIComponent(stanzaId)}#search-spl`;
};

type MetricDetailTableColumnKind = "text" | "status" | "metric";

interface MetricDetailTableColumn {
  field: string;
  label: string;
  align?: "left" | "right";
  kind?: MetricDetailTableColumnKind;
  fallback?: string;
  truncate?: boolean;
}

interface MetricDetailTableTargetConfig {
  searchbaseId: string;
  defaultViz?: string;
  vizOptions?: Record<string, unknown>;
  metadata: SearchbaseDrilldownMetadata;
  subtitle: (range: TimeRange) => string;
  spl: string;
  dispatchContext?: string;
  tag: string;
  rowKeyField: string;
  emptyMessage: string;
  errorMessage: string;
  statusField?: string;
  availableStatus?: string;
  unavailableStatus?: string;
  columns: MetricDetailTableColumn[];
}

interface MetricDetailTableConfig {
  title: string;
  buttonTitle: string;
  targets: MetricDetailTableTargetConfig[];
}

const DETAIL_TABLE_COLUMN_KINDS = new Set<MetricDetailTableColumnKind>([
  "text",
  "status",
  "metric",
]);

const readDetailStringOption = (
  options: Record<string, unknown> | undefined,
  key: string,
): string | undefined => {
  const raw = options?.[key];
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 && trimmed.length <= 256 ? trimmed : undefined;
};

const parseDetailTableColumns = (raw: unknown): MetricDetailTableColumn[] => {
  if (!Array.isArray(raw)) return [];
  const columns: MetricDetailTableColumn[] = [];
  raw.forEach((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return;
    const candidate = item as Record<string, unknown>;
    const field =
      typeof candidate.field === "string" ? candidate.field.trim() : "";
    const label =
      typeof candidate.label === "string" ? candidate.label.trim() : field;
    if (!field || !label || field.length > 96 || label.length > 96) return;
    const align =
      candidate.align === "right" || candidate.align === "left"
        ? candidate.align
        : undefined;
    const kind =
      typeof candidate.kind === "string" &&
      DETAIL_TABLE_COLUMN_KINDS.has(
        candidate.kind as MetricDetailTableColumnKind,
      )
        ? (candidate.kind as MetricDetailTableColumnKind)
        : undefined;
    const fallback =
      typeof candidate.fallback === "string"
        ? candidate.fallback.slice(0, 120)
        : undefined;
    columns.push({
      field,
      label,
      align,
      kind,
      fallback,
      truncate: candidate.truncate === true,
    });
  });
  return columns.slice(0, 12);
};

const INFERRED_DETAIL_TABLE_SKIP_FIELDS = new Set([
  "_raw",
  "_serial",
  "_si",
  "_span",
  "splunk_server",
]);

const humanizeDetailFieldLabel = (field: string): string =>
  field
    .replace(/^Test_Metrics\./, "")
    .replace(/[_.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const isNumericLike = (value: unknown): boolean => {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string") return false;
  return /^-?\d+(?:\.\d+)?%?$/.test(value.trim());
};

const inferDetailTableColumns = (
  rows: Array<Record<string, unknown>>,
): MetricDetailTableColumn[] => {
  const fields: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const field of Object.keys(row)) {
      if (seen.has(field)) continue;
      if (INFERRED_DETAIL_TABLE_SKIP_FIELDS.has(field)) continue;
      if (field.startsWith("_") && field !== "_time") continue;
      seen.add(field);
      fields.push(field);
      if (fields.length >= 12) break;
    }
    if (fields.length >= 12) break;
  }
  return fields.map((field) => {
    const sample = rows.find((row) => row[field] !== undefined)?.[field];
    return {
      field,
      label: humanizeDetailFieldLabel(field),
      align: isNumericLike(sample) ? "right" : undefined,
      truncate: field.length > 32,
    };
  });
};

const interpolateDetailSubtitle = (
  template: string,
  source: SearchbaseRecord,
  detail: SearchbaseRecord,
  range: TimeRange,
): string =>
  template
    .replace(/\{rangeLabel\}/g, range.label.toLowerCase())
    .replace(/\{RangeLabel\}/g, range.label)
    .replace(/\{searchName\}/g, source.searchName)
    .replace(/\{drilldownSearchName\}/g, detail.searchName);

const buildMetricDetailTableConfig = (
  source: SearchbaseRecord | null,
  searchbaseByName: Map<string, SearchbaseRecord> | null | undefined,
  searchbaseById: Map<string, SearchbaseRecord> | null | undefined,
  searchbaseDrilldowns: SearchbaseDrilldownMap,
): MetricDetailTableConfig | null => {
  const userDrilldown =
    source &&
    Object.prototype.hasOwnProperty.call(
      searchbaseDrilldowns,
      source.searchName,
    )
      ? searchbaseDrilldowns[source.searchName]
      : undefined;
  const drilldownNames =
    userDrilldown === null
      ? []
      : userDrilldown !== undefined
        ? [userDrilldown.trim()].filter(Boolean)
        : source?.drilldownSearchNames?.length
          ? source.drilldownSearchNames
          : [source?.drilldownSearchName?.trim() ?? ""].filter(Boolean);
  if (!source || drilldownNames.length === 0) return null;
  // Stanza ids are canonical; friendly names remain a compatibility alias
  // for existing local/searchbase.conf and browser-persisted overrides.
  const seen = new Set<string>();
  const details = drilldownNames
    .map((drilldownName) => {
      const ownerApp = source.ownerApp;
      return (
        searchbaseById?.get(
          searchbaseRecordReferenceFromParts(ownerApp, drilldownName),
        ) ??
        searchbaseByName?.get(
          searchbaseRecordNameReference(ownerApp, drilldownName),
        ) ??
        searchbaseById?.get(drilldownName) ??
        searchbaseByName?.get(drilldownName)
      );
    })
    .filter((detail): detail is SearchbaseRecord => {
      if (!detail?.search || seen.has(detail.id)) return false;
      seen.add(detail.id);
      return true;
    });
  if (details.length === 0) return null;
  const primaryOptions = details[0].vizOptions;
  return {
    title:
      readDetailStringOption(primaryOptions, "modalTitle") ??
      `Drill down: ${source.searchName}`,
    buttonTitle:
      source.drilldownButtonTitle ??
      readDetailStringOption(primaryOptions, "buttonTitle") ??
      `View ${source.searchName} detail`,
    targets: details.map((detail) => {
      const options = detail.vizOptions;
      const columns = parseDetailTableColumns(options?.columns);
      const subtitleTemplate =
        readDetailStringOption(options, "modalSubtitle") ??
        "Supporting Searchbase results and guidance for {rangeLabel}.";
      const tag = `detail_table_${detail.id || detail.searchName}`.replace(
        /[^A-Za-z0-9_]+/g,
        "_",
      );
      return {
        searchbaseId: detail.id,
        defaultViz: detail.defaultViz,
        vizOptions: detail.vizOptions,
        metadata: {
          title: detail.searchName,
          category: detail.category,
          subCategory: detail.subCategory,
          description: detail.description,
          explanation: detail.explanation,
          solution: detail.solution,
          relatedInfo: detail.relatedInfo,
          executionPlan: detail.executionPlan,
        },
        subtitle: (range: TimeRange) =>
          interpolateDetailSubtitle(subtitleTemplate, source, detail, range),
        spl: detail.search,
        dispatchContext: detail.dispatchContext,
        tag,
        rowKeyField:
          readDetailStringOption(options, "rowKeyField") ??
          columns[0]?.field ??
          "",
        emptyMessage:
          readDetailStringOption(options, "emptyMessage") ??
          "No detail rows returned for this time range.",
        errorMessage:
          readDetailStringOption(options, "errorMessage") ??
          `Unable to load ${detail.searchName}.`,
        statusField: readDetailStringOption(options, "statusField"),
        availableStatus: readDetailStringOption(options, "availableStatus"),
        unavailableStatus: readDetailStringOption(options, "unavailableStatus"),
        columns,
      };
    }),
  };
};

const resolveSearchbaseRecordForConfig = (
  cfg:
    | Pick<MetricConfig, "searchbaseId" | "savedSearch">
    | Pick<KpiConfig, "searchbaseId" | "savedSearch">,
  searchbaseById: Map<string, SearchbaseRecord> | null | undefined,
  searchbaseByName: Map<string, SearchbaseRecord> | null | undefined,
): SearchbaseRecord | null => {
  if (cfg.searchbaseId && searchbaseById) {
    const byId = searchbaseById.get(cfg.searchbaseId);
    if (byId) return byId;
  }
  if (cfg.savedSearch && searchbaseByName) {
    return searchbaseByName.get(cfg.savedSearch) ?? null;
  }
  return null;
};

// =============================================================================
// Per-metric component (renders one MetricItem and reports its status up)
// =============================================================================

interface MetricCardProps {
  cfg: MetricConfig;
  /** Staged dispatch group: rail=0, then sections=10/20/30/40. */
  dispatchPriority: number;
  range: TimeRange;
  refreshToken: number;
  onStatus: (id: string, status: MetricStatus) => void;
  /**
   * Where the per-metric Info tooltip should anchor. Pass 'right'
   * for the rightmost metric in a section so the popover doesn't
   * overflow the card.
   */
  infoAnchor?: "auto" | "left" | "right";
  /** Tightens nonessential chart chrome when the available viewport is short. */
  compactDensity?: boolean;
  /**
   * Optional override applied on top of the static config. When
   * present, the gear icon is rendered with a "modified" dot.
   */
  override?: MetricOverride;
  onConfigure: (returnFocus?: HTMLElement | null) => void;
  onOpenDetailTable?: (config: MetricDetailTableConfig) => void;
  searchbaseDrilldowns: SearchbaseDrilldownMap;
  /**
   * Lookup of `searchbase.conf` entries keyed by `search_name`.
   *
   * - `null`        → still loading (defer dispatch; show mock).
   * - `Map (size 0)` -> finished loading but empty (fetch failed or
   *                   conf empty). Falls back to the configured binding.
   * - `Map`          → loaded; tile dispatches the literal `search`
   *                   from the matching entry.
   *
   * When a tile's effective binding matches an entry, the
   * dashboard *runtime* dispatches that entry's `search` field
   * (what the executive sees in the picker preview) and the
   * drilldown follows the same SPL — keeping the runtime, the
   * preview, and the drilldown in lockstep.
   */
  searchbaseByName: Map<string, SearchbaseRecord> | null;
  /** Same catalogue keyed by searchbase stanza id. Factory tiles resolve by id. */
  searchbaseById: Map<string, SearchbaseRecord> | null;
}

/**
 * Returns a cloned MetricConfig with the current viewer's *display*
 * preferences merged in (chart style, chrome-hiding toggles). This is
 * intentionally a small function now.
 *
 * Search binding, value field, label, and thresholds used to be
 * merged here too, from a per-user localStorage override. They moved
 * to admin-controlled `searchbase.conf` (`searchbaseTileConfigService`)
 * so every viewer sees the same binding/label/thresholds — which
 * means `cfg` (built straight from the searchbase catalogue) is
 * already the effective value for those fields, with no client-side
 * merge needed. `applyOverride` only has display taste left to apply.
 */
const applyOverride = (
  cfg: MetricConfig,
  override?: MetricOverride,
): MetricConfig => {
  if (!override) return cfg;
  return cfg;
};

const SPARKLINE_VIZ_OVERRIDES = new Set<MetricVizOverride>([
  "area",
  "line",
  "column",
  "bar",
  "singlevalue",
]);

const isSparklineVizOverride = (
  value: MetricVizOverride | undefined,
): value is SparklineVizType =>
  Boolean(value && SPARKLINE_VIZ_OVERRIDES.has(value));

const structuralVizFromOverride = (
  value: MetricVizOverride | undefined,
): string | undefined => {
  switch (value) {
    case "table":
      return "splunk.table";
    case "barbreakdown":
      return "splunk.bar";
    case "pie":
      return "splunk.pie";
    case "singlevalueradial":
      return "splunk.singlevalueradial";
    case "fillergauge":
      return "splunk.fillergauge";
    case "markergauge":
      return "splunk.markergauge";
    default:
      return undefined;
  }
};

const firstSeriesColorFromVizOptions = (
  options: Record<string, unknown> | undefined,
  fallback = "#0ea5e9",
): string => {
  const seriesColors = options?.seriesColors;
  if (!Array.isArray(seriesColors)) return fallback;
  const first = seriesColors.find((value) => typeof value === "string");
  return typeof first === "string" && /^#[0-9a-f]{3,8}$/i.test(first.trim())
    ? first.trim()
    : fallback;
};

const seriesColorsFromVizOptions = (
  options: Record<string, unknown> | undefined,
): string[] | undefined => {
  const seriesColors = options?.seriesColors;
  if (!Array.isArray(seriesColors)) return undefined;
  const valid = seriesColors.filter(
    (value): value is string =>
      typeof value === "string" && /^#[0-9a-f]{3,8}$/i.test(value.trim()),
  );
  return valid.length > 0 ? valid.map((value) => value.trim()) : undefined;
};

const MetricCard: React.FC<MetricCardProps> = ({
  cfg,
  dispatchPriority,
  range,
  refreshToken,
  onStatus,
  infoAnchor = "auto",
  compactDensity = false,
  override,
  onConfigure,
  onOpenDetailTable,
  searchbaseDrilldowns,
  searchbaseByName,
  searchbaseById,
}) => {
  const effective = useMemo(
    () => applyOverride(cfg, override),
    [cfg, override],
  );

  // ---------------------------------------------------------------
  // Runtime dispatch config (the SPL the dashboard actually runs)
  // ---------------------------------------------------------------
  // searchbase.conf is the source of truth for SPL the user sees and
  // tweaks. When a tile's effective binding has a matching
  // searchbase entry, we replace the dispatch with the literal
  // `search` field — same SPL the picker preview renders, same SPL
  // the "Open in Search" drilldown opens. This keeps everything the
  // executive interacts with in lock-step.
  //
  // While the searchbase maps are `null` (still loading), we defer the
  // dispatch by stripping spl + savedSearch — useMetric short-circuits
  // to mock and waits. That avoids a "ghost dispatch" that fires
  // compatibility binding on first paint and gets superseded a
  // second later by the real searchbase SPL (double network round-trip).
  //
  // If a binding no longer exists in searchbase.conf, do not fall
  // back to savedsearch-command indirection. The overview's shipped
  // tiles must be searchbase-backed only; a missing stanza should
  // render as demo/empty state until the binding is corrected.
  const dispatchedConfig = useMemo<typeof effective>(() => {
    const prioritized = { ...effective, dispatchPriority };
    if (!effective.savedSearch && !effective.searchbaseId) return prioritized;
    if (
      searchbaseByName === null ||
      searchbaseByName === undefined ||
      searchbaseById === null ||
      searchbaseById === undefined
    ) {
      return { ...prioritized, savedSearch: undefined, spl: undefined };
    }
    const sb = resolveSearchbaseRecordForConfig(
      effective,
      searchbaseById,
      searchbaseByName,
    );
    if (sb && sb.search) {
      return {
        ...prioritized,
        spl: sb.search,
        savedSearch: undefined,
        dispatchContext: sb.dispatchContext,
      };
    }
    return { ...prioritized, savedSearch: undefined, spl: undefined };
  }, [dispatchPriority, effective, searchbaseById, searchbaseByName]);

  // Resolve the conf record (if any) so we can pull viz hints from it.
  // The picker preview, drilldown, and tile renderer must all agree
  // on which entry is in play — we use the same id/name resolution
  // the dispatch logic above already does.
  const sbRecord = useMemo(() => {
    if (!effective.savedSearch && !effective.searchbaseId) return null;
    return resolveSearchbaseRecordForConfig(
      effective,
      searchbaseById,
      searchbaseByName,
    );
  }, [effective, searchbaseById, searchbaseByName]);

  const detailTableConfig = useMemo(
    () =>
      buildMetricDetailTableConfig(
        sbRecord,
        searchbaseByName,
        searchbaseById,
        searchbaseDrilldowns,
      ),
    [sbRecord, searchbaseById, searchbaseByName, searchbaseDrilldowns],
  );
  const openDetailTable =
    detailTableConfig && onOpenDetailTable
      ? () => onOpenDetailTable(detailTableConfig)
      : undefined;

  // Branch on viz type: structural visualisations get wholly different
  // rendering paths (TableTile / PieTile / gauge tiles + the matching
  // data hook) so we never coerce categorical row distributions or
  // gauge canvases through the single-value/sparkline pipeline. The
  // branch is component-level (rather than inside the body) so each
  // leaf calls its own data hook unconditionally — Rules of Hooks
  // forbid switching `useMetric` ↔ `useTableData` between renders.
  //
  // Override rules:
  //   • structural picker choices (`table`, `pie`, gauges, breakdown)
  //     win over searchbase `default_viz`.
  //   • sparkline picker choices (`area`, `line`, `column`, `bar`,
  //     `singlevalue`) force the MetricItem path, even if the
  //     searchbase default is a structural viz.
  //   • no override falls back to the searchbase default.
  const vizOverride = override?.vizOverride;
  const structuralViz = structuralVizFromOverride(vizOverride);
  const renderViz =
    structuralViz ?? (vizOverride ? undefined : sbRecord?.defaultViz);
  const sparklineVizOverride = isSparklineVizOverride(vizOverride)
    ? vizOverride
    : undefined;
  const showTable = isTableViz(renderViz);
  const showBarBreakdown = isBarBreakdownViz(renderViz);
  const showPie = isPieViz(renderViz);
  const showSingleValueRadial = isSingleValueRadialViz(renderViz);
  const showFillerGauge = isFillerGaugeViz(renderViz);
  const showMarkerGauge = isMarkerGaugeViz(renderViz);

  if (showTable) {
    return (
      <TableCardLeaf
        effective={effective}
        dispatchedConfig={dispatchedConfig}
        searchbaseId={sbRecord?.id}
        range={range}
        refreshToken={refreshToken}
        onStatus={onStatus}
        onConfigure={onConfigure}
        onOpenDetailTable={openDetailTable}
        detailTableTitle={detailTableConfig?.buttonTitle}
        infoAnchor={infoAnchor}
        isCustomized={Boolean(override)}
      />
    );
  }
  if (showBarBreakdown) {
    return (
      <BarBreakdownCardLeaf
        effective={effective}
        dispatchedConfig={dispatchedConfig}
        searchbaseId={sbRecord?.id}
        range={range}
        refreshToken={refreshToken}
        onStatus={onStatus}
        onConfigure={onConfigure}
        onOpenDetailTable={openDetailTable}
        detailTableTitle={detailTableConfig?.buttonTitle}
        infoAnchor={infoAnchor}
        isCustomized={Boolean(override)}
      />
    );
  }
  if (showPie) {
    return (
      <PieCardLeaf
        effective={effective}
        dispatchedConfig={dispatchedConfig}
        sbRecord={sbRecord}
        searchbaseId={sbRecord?.id}
        range={range}
        refreshToken={refreshToken}
        onStatus={onStatus}
        onConfigure={onConfigure}
        onOpenDetailTable={openDetailTable}
        detailTableTitle={detailTableConfig?.buttonTitle}
        infoAnchor={infoAnchor}
        isCustomized={Boolean(override)}
      />
    );
  }
  if (showSingleValueRadial || showFillerGauge || showMarkerGauge) {
    return (
      <ScalarGaugeCardLeaf
        effective={effective}
        dispatchedConfig={dispatchedConfig}
        sbRecord={sbRecord}
        searchbaseId={sbRecord?.id}
        variant={
          showSingleValueRadial
            ? "singlevalueradial"
            : showFillerGauge
              ? "fillergauge"
              : "markergauge"
        }
        range={range}
        refreshToken={refreshToken}
        onStatus={onStatus}
        onConfigure={onConfigure}
        onOpenDetailTable={openDetailTable}
        detailTableTitle={detailTableConfig?.buttonTitle}
        infoAnchor={infoAnchor}
        isCustomized={Boolean(override)}
        hideDelta={override?.hideDelta}
      />
    );
  }
  return (
    <MetricCardLeaf
      effective={effective}
      dispatchedConfig={dispatchedConfig}
      sbRecord={sbRecord}
      searchbaseId={sbRecord?.id}
      range={range}
      refreshToken={refreshToken}
      onStatus={onStatus}
      onConfigure={onConfigure}
      onOpenDetailTable={openDetailTable}
      detailTableTitle={detailTableConfig?.buttonTitle}
      infoAnchor={infoAnchor}
      isCustomized={Boolean(override)}
      vizOverride={sparklineVizOverride}
      hidePeak={override?.hidePeak}
      hideDelta={override?.hideDelta}
      hideOverlay={override?.hideOverlay}
      compactDensity={compactDensity}
    />
  );
};

interface CommonLeafProps {
  effective: MetricConfig;
  dispatchedConfig: MetricConfig;
  searchbaseId?: string;
  range: TimeRange;
  refreshToken: number;
  onStatus: (id: string, status: MetricStatus) => void;
  onConfigure: () => void;
  onOpenDetailTable?: () => void;
  detailTableTitle?: string;
  infoAnchor: "auto" | "left" | "right";
  isCustomized: boolean;
}

interface MetricCardLeafProps extends CommonLeafProps {
  sbRecord: SearchbaseRecord | null;
  /**
   * User-picked viz override (Build 1174, extended in 1187). When
   * set, takes precedence over `searchbase.conf`'s `default_viz`
   * for the sparkline render path. `applyOverride()` does NOT
   * bake this into `effective` because the override applies to
   * the chart rendering, not the metric semantics — the same
   * headline value, threshold, and SPL keep flowing through;
   * only the viz primitive changes.
   */
  vizOverride?: SparklineVizType;
  /**
   * Display toggles (Build 1202, from Atef's review). When set,
   * suppress the corresponding chrome around the headline value:
   *   • `hidePeak` → forces `dataValuesDisplay='off'` so the
   *     Sparkline draws without min/peak bubble labels.
   *   • `hideDelta` → drops the `change` prop so MetricItem renders
   *     no ↑/↓ percentage pill next to the headline.
   *   • `hideOverlay` (Build 1203) → suppresses the dashed
   *     previous-period (or baseline) line on the sparkline by
   *     passing `previousData={undefined}` to MetricItem. The
   *     primary trend stays; only the comparison overlay goes away.
   * All three default to `undefined` (treated as `false`); the
   * runtime merge layer in `applyOverride` deliberately leaves
   * these on the override object — they affect rendering, not
   * metric semantics, same shape as `vizOverride`.
   */
  hidePeak?: boolean;
  hideDelta?: boolean;
  hideOverlay?: boolean;
  compactDensity?: boolean;
}

/**
 * Sparkline-tile leaf: single-value KPI rendered through MetricItem.
 * Mirrors the original MetricCard body verbatim; extracted into a
 * named component only so `MetricCard` can choose between this and
 * `TableCardLeaf` without violating the Rules of Hooks.
 */
const MetricCardLeaf: React.FC<MetricCardLeafProps> = ({
  effective,
  dispatchedConfig,
  searchbaseId,
  sbRecord,
  range,
  refreshToken,
  onStatus,
  onConfigure,
  onOpenDetailTable,
  detailTableTitle,
  infoAnchor,
  isCustomized,
  vizOverride,
  hidePeak,
  hideDelta,
  hideOverlay,
  compactDensity = false,
}) => {
  /**
   * Tile viz variant. Resolution order (highest precedence first):
   *   1. `vizOverride` — Build 1174 picker setting per tile, persisted
   *      in localStorage via `usePersistedMetricOverrides`. Lets the
   *      operator switch chart style (area / line / column /
   *      singlevalue) without touching the searchbase or forking the
   *      tile.
   *   2. `searchbase.conf`'s `default_viz` — conf-level default.
   *   3. Fallback to `area` (the prior project-wide default), handled
   *      inside `sparklineVizTypeFromSplunkViz` for unknown / absent
   *      ids.
   *
   * Cross-binding behaviour: when the picker switches the searchbase
   * binding (a different `savedSearch`) WITHOUT setting `vizOverride`,
   * the tile inherits the new binding's `default_viz`. With
   * `vizOverride` set, the chart style is pinned regardless of which
   * binding drives the data — the override is about *how* it's drawn,
   * not what it's drawing.
   */
  const vizType = useMemo(
    () => vizOverride ?? sparklineVizTypeFromSplunkViz(sbRecord?.defaultViz),
    [vizOverride, sbRecord?.defaultViz],
  );

  /**
   * `viz_options.seriesColors[0]` overrides the static config colour
   * so the conf author can drive both viz type and palette in one
   * place. We only use the first entry (sparklines are single-series
   * today); multi-series support would honour the full array.
   */
  const tileColor = useMemo(() => {
    const seriesColors = sbRecord?.vizOptions?.seriesColors;
    if (Array.isArray(seriesColors)) {
      const first = seriesColors[0];
      if (
        typeof first === "string" &&
        /^#[0-9a-fA-F]{3,8}$/.test(first.trim())
      ) {
        return first.trim();
      }
    }
    return effective.color;
  }, [effective.color, sbRecord?.vizOptions]);

  /**
   * `viz_options.dataValuesDisplay` controls how Sparkline labels
   * the high/low points (Studio v2 analogue). Anything missing or
   * malformed falls through to the Sparkline default of `'minmax'`,
   * which is the project-wide policy now that the hardcoded peak
   * marker has been retired.
   */
  const dataValuesDisplay = useMemo(
    () => normalizeDataValuesDisplay(sbRecord?.vizOptions?.dataValuesDisplay),
    [sbRecord?.vizOptions],
  );

  const result = useMetric(dispatchedConfig, range, refreshToken);

  useEffect(() => {
    onStatus(effective.id, result.status);
  }, [effective.id, result.status, onStatus]);

  // Drilldown SPL — what we open in Splunk Search when the user
  // clicks the "open in search" icon. Prefer the resolved searchbase
  // SPL so the action remains available even when the result set is
  // empty, mocked, or still loading.
  const drilldownSpl = dispatchedConfig.spl ?? result.spl;
  const drilldownHref = useMemo(() => {
    if (!drilldownSpl) return undefined;
    return splunkSearchAppUrl(
      drilldownSpl,
      range,
      dispatchedConfig.dispatchContext,
    );
  }, [dispatchedConfig.dispatchContext, drilldownSpl, range]);

  // Threshold rows are derived from the same `MetricThresholds` the
  // runtime uses to colour the headline (`computeStatus`), so the
  // popover and the live tile colour can never disagree. The unit
  // ("%", "ms", etc.) is appended verbatim. For tiles whose unit
  // doesn't apply to the threshold (e.g. `critical_website_availability`
  // headline is "X of Y" but the threshold is on a percentage),
  // `thresholdNote` clarifies; factory values come from searchbase.conf
  // `viz_options.overview`.
  const thresholdLines = useMemo(
    () => deriveThresholdLines(effective.thresholds, effective.unit),
    [effective.thresholds, effective.unit],
  );

  return (
    <MetricItem
      label={effective.label}
      subLabel={effective.subLabel}
      description={effective.description}
      infoSections={effective.infoSections}
      // Footnote intentionally omitted: surfacing the literal SPL
      // in the info tooltip clutters the executive view and
      // duplicates what the "Open in Search" icon already
      // exposes. The SPL is one click away — we don't need to
      // dump it into a hover popover too.
      descriptionFootnote={undefined}
      thresholdLines={thresholdLines}
      thresholdNote={effective.thresholdNote}
      infoAnchor={infoAnchor}
      // `displayValue` (string broadcast from the search) wins
      // over the numeric `value` when present. Status, threshold,
      // and change still derive from the numeric `value` so the
      // headline color remains accurate even for tiles that
      // render a non-numeric headline (e.g. "12 of 18 available").
      value={
        typeof result.displayValue === "string"
          ? result.displayValue
          : result.value
      }
      unit={typeof result.displayValue === "string" ? "" : effective.unit}
      // `hideDelta` (Build 1202) drops the change pill entirely
      // by omitting the `change` prop. MetricItem's `showChange`
      // guard treats `undefined` as "no pill" — same path as
      // tiles whose search emits no comparable previous-period
      // value, so we get the right rendering with zero extra
      // MetricItem branching.
      change={hideDelta ? undefined : result.change}
      sparkData={result.sparkData}
      // `hideOverlay` (Build 1203) drops the dashed previous-
      // period / baseline line from the sparkline canvas by
      // omitting `previousData` and its label. The Sparkline
      // component treats `undefined` as "no overlay" — the
      // same path as tiles whose search doesn't emit a
      // comparable previous series — so we get the right
      // rendering with no extra Sparkline branching. The
      // primary trend, peaks (if enabled), and headline are
      // unaffected.
      previousData={hideOverlay ? undefined : result.previousSparkData}
      previousLabel={hideOverlay ? undefined : effective.overlayLabel}
      sparkTimestamps={result.sparkTimestamps}
      timeRange={range}
      color={tileColor}
      vizType={vizType}
      // `hidePeak` (Build 1202) forces the Sparkline to draw
      // without min/peak bubble labels. Mapping to the existing
      // `'off'` mode (the Studio v2 analogue Sparkline already
      // supports) means we don't add a new prop — we just pin
      // the existing one regardless of what the searchbase
      // entry asked for.
      dataValuesDisplay={hidePeak ? "off" : dataValuesDisplay}
      sparklineDensity={compactDensity ? "compact" : "detailed"}
      status={result.status}
      source={result.source}
      openInSearchHref={drilldownHref}
      searchbaseId={searchbaseId}
      onOpenDetailTable={onOpenDetailTable}
      detailTableTitle={detailTableTitle}
      onConfigure={onConfigure}
      isCustomized={isCustomized}
      sparkTitle={
        // The chart itself is no longer a click target — the
        // ExternalLink icon next to the tile label is the
        // explicit drilldown affordance. We keep `sparkTitle`
        // around as a hover hint so users still discover the
        // per-bucket Recharts tooltip.
        drilldownSpl ? "Hover for date and value" : undefined
      }
      noDataReason={result.noDataReason}
      rangeLabel={result.rangeLabel}
    />
  );
};

/**
 * Categorical-tile leaf: multi-row table rendered through TableTile.
 * Activated when the bound searchbase stanza declares
 * `default_viz = splunk.table`. Tables don't have a "status" in the
 * threshold sense, so we always emit `unknown` to keep the aggregate
 * health badge math identical to before this branch existed.
 */
const TableCardLeaf: React.FC<CommonLeafProps> = ({
  effective,
  dispatchedConfig,
  searchbaseId,
  range,
  refreshToken,
  onStatus,
  onConfigure,
  onOpenDetailTable,
  detailTableTitle,
  infoAnchor,
  isCustomized,
}) => {
  const result = useTableData(dispatchedConfig, range, refreshToken);

  useEffect(() => {
    onStatus(effective.id, "unknown");
  }, [effective.id, onStatus]);

  const drilldownSpl = dispatchedConfig.spl ?? result.spl;
  const drilldownHref = useMemo(() => {
    if (!drilldownSpl) return undefined;
    return splunkSearchAppUrl(
      drilldownSpl,
      range,
      dispatchedConfig.dispatchContext,
    );
  }, [dispatchedConfig.dispatchContext, drilldownSpl, range]);

  return (
    <TableTile
      label={effective.label}
      subLabel={effective.subLabel}
      description={effective.description}
      infoSections={effective.infoSections}
      descriptionFootnote={undefined}
      thresholdNote={effective.thresholdNote}
      infoAnchor={infoAnchor}
      rows={result.rows}
      columns={result.columns}
      totalRowCount={result.totalRowCount}
      source={result.source}
      openInSearchHref={drilldownHref}
      searchbaseId={searchbaseId}
      onOpenDetailTable={onOpenDetailTable}
      detailTableTitle={detailTableTitle}
      onConfigure={onConfigure}
      isCustomized={isCustomized}
      noDataReason={result.noDataReason}
      rangeLabel={result.rangeLabel}
    />
  );
};

/**
 * Bar-breakdown leaf: single-series categorical distribution rendered
 * through BarBreakdownTile. Activated when the bound searchbase stanza
 * declares `default_viz = splunk.bar`. Reuses the table dispatcher
 * (`useTableData`) since the underlying SPL shape is the same
 * (`<dimension>, <count>`), then paints the rows as horizontal bars
 * with a sum headline. Status is always `unknown` for the same reason
 * as TableCardLeaf — no per-row threshold semantics — so the
 * aggregate health badge math is unchanged.
 */
const BarBreakdownCardLeaf: React.FC<CommonLeafProps> = ({
  effective,
  dispatchedConfig,
  searchbaseId,
  range,
  refreshToken,
  onStatus,
  onConfigure,
  onOpenDetailTable,
  detailTableTitle,
  infoAnchor,
  isCustomized,
}) => {
  const result = useTableData(dispatchedConfig, range, refreshToken);

  useEffect(() => {
    onStatus(effective.id, "unknown");
  }, [effective.id, onStatus]);

  const drilldownSpl = dispatchedConfig.spl ?? result.spl;
  const drilldownHref = useMemo(() => {
    if (!drilldownSpl) return undefined;
    return splunkSearchAppUrl(
      drilldownSpl,
      range,
      dispatchedConfig.dispatchContext,
    );
  }, [dispatchedConfig.dispatchContext, drilldownSpl, range]);

  return (
    <BarBreakdownTile
      label={effective.label}
      subLabel={effective.subLabel}
      description={effective.description}
      infoSections={effective.infoSections}
      descriptionFootnote={undefined}
      thresholdNote={effective.thresholdNote}
      infoAnchor={infoAnchor}
      rows={result.rows}
      columns={result.columns}
      source={result.source}
      openInSearchHref={drilldownHref}
      searchbaseId={searchbaseId}
      onOpenDetailTable={onOpenDetailTable}
      detailTableTitle={detailTableTitle}
      onConfigure={onConfigure}
      isCustomized={isCustomized}
      noDataReason={result.noDataReason}
      rangeLabel={result.rangeLabel}
    />
  );
};

interface PieCardLeafProps extends CommonLeafProps {
  sbRecord: SearchbaseRecord | null;
}

/**
 * Pie leaf: table-shaped categorical data rendered as slices. This
 * uses the same dispatcher as TableTile / BarBreakdownTile because
 * `splunk.pie` expects rows shaped like `<dimension>, <value>`.
 */
const PieCardLeaf: React.FC<PieCardLeafProps> = ({
  effective,
  dispatchedConfig,
  sbRecord,
  searchbaseId,
  range,
  refreshToken,
  onStatus,
  onConfigure,
  onOpenDetailTable,
  detailTableTitle,
  infoAnchor,
  isCustomized,
}) => {
  const result = useTableData(dispatchedConfig, range, refreshToken);

  useEffect(() => {
    onStatus(effective.id, "unknown");
  }, [effective.id, onStatus]);

  const drilldownSpl = dispatchedConfig.spl ?? result.spl;
  const handleClick = useCallback(() => {
    if (!drilldownSpl) return;
    const url = splunkSearchAppUrl(
      drilldownSpl,
      range,
      dispatchedConfig.dispatchContext,
    );
    if (typeof window !== "undefined")
      window.open(url, "_blank", "noopener,noreferrer");
  }, [dispatchedConfig.dispatchContext, drilldownSpl, range]);

  return (
    <PieTile
      label={effective.label}
      subLabel={effective.subLabel}
      description={effective.description}
      infoSections={effective.infoSections}
      descriptionFootnote={undefined}
      thresholdNote={effective.thresholdNote}
      infoAnchor={infoAnchor}
      rows={result.rows}
      columns={result.columns}
      seriesColors={seriesColorsFromVizOptions(sbRecord?.vizOptions)}
      source={result.source}
      onOpenInSearch={drilldownSpl ? handleClick : undefined}
      searchbaseId={searchbaseId}
      onOpenDetailTable={onOpenDetailTable}
      detailTableTitle={detailTableTitle}
      onConfigure={onConfigure}
      isCustomized={isCustomized}
      noDataReason={result.noDataReason}
      rangeLabel={result.rangeLabel}
    />
  );
};

interface ScalarGaugeCardLeafProps extends CommonLeafProps {
  sbRecord: SearchbaseRecord | null;
  variant: "singlevalueradial" | "fillergauge" | "markergauge";
  hideDelta?: boolean;
}

/**
 * Scalar gauge leaf: single-value searches rendered through the
 * Canvas-style gauge family instead of a sparkline. These still use
 * `useMetric`, so value-field detection, thresholds, no-data handling,
 * and Open-in-Search behaviour stay identical to MetricItem.
 */
const ScalarGaugeCardLeaf: React.FC<ScalarGaugeCardLeafProps> = ({
  effective,
  dispatchedConfig,
  sbRecord,
  searchbaseId,
  variant,
  range,
  refreshToken,
  onStatus,
  onConfigure,
  onOpenDetailTable,
  detailTableTitle,
  isCustomized,
  hideDelta,
}) => {
  const result = useMetric(dispatchedConfig, range, refreshToken);

  useEffect(() => {
    onStatus(effective.id, result.status);
  }, [effective.id, result.status, onStatus]);

  const drilldownSpl = dispatchedConfig.spl ?? result.spl;
  const handleClick = useCallback(() => {
    if (!drilldownSpl) return;
    const url = splunkSearchAppUrl(
      drilldownSpl,
      range,
      dispatchedConfig.dispatchContext,
    );
    if (typeof window !== "undefined")
      window.open(url, "_blank", "noopener,noreferrer");
  }, [dispatchedConfig.dispatchContext, drilldownSpl, range]);

  const tileColor = useMemo(
    () => firstSeriesColorFromVizOptions(sbRecord?.vizOptions, effective.color),
    [effective.color, sbRecord?.vizOptions],
  );
  const value =
    typeof result.displayValue === "string"
      ? result.displayValue
      : result.value;
  const unit = typeof result.displayValue === "string" ? "" : effective.unit;
  const commonProps = {
    label: effective.label,
    subLabel: effective.subLabel,
    description: effective.description,
    infoSections: effective.infoSections,
    descriptionFootnote: undefined,
    thresholdNote: effective.thresholdNote,
    value,
    unit,
    accentColor: tileColor,
    vizOptions: sbRecord?.vizOptions,
    source: result.source,
    onOpenInSearch: drilldownSpl ? handleClick : undefined,
    searchbaseId,
    onConfigure,
    onOpenDetailTable,
    detailTableTitle,
    isCustomized,
    noDataReason: result.noDataReason,
    rangeLabel: result.rangeLabel,
  };

  if (variant === "singlevalueradial") {
    return (
      <SingleValueRadialTile
        {...commonProps}
        change={hideDelta ? undefined : result.change}
      />
    );
  }
  if (variant === "fillergauge") {
    return <FillerGaugeTile {...commonProps} />;
  }
  return <MarkerGaugeTile {...commonProps} />;
};

// =============================================================================
// Page
// =============================================================================

interface InsightsWorkspaceRuntimeProps {
  workspace: InsightsWorkspace;
  workspaces: readonly InsightsWorkspace[];
  initialLayout: WorkspaceLayoutConfig;
  layouts: Record<WorkspaceId, WorkspaceLayoutConfig>;
  signalRails: Record<WorkspaceId, SignalTickerConfig>;
  signalTickerDefault: SignalTickerConfig;
  onWorkspaceUpdated?: (workspace: InsightsWorkspace) => void;
  onSignalRailUpdated?: (
    workspaceId: WorkspaceId,
    config: SignalTickerConfig,
  ) => void;
}

const InsightsWorkspaceRuntime: React.FC<InsightsWorkspaceRuntimeProps> = ({
  workspace: insightsWorkspace,
  workspaces,
  initialLayout,
  layouts,
  signalRails,
  signalTickerDefault,
  onWorkspaceUpdated,
  onSignalRailUpdated,
}) => {
  // ------------------------------ Theme ------------------------------
  const { inputBorderWidth, inputHeight, spacingSmall, spacingXSmall } =
    useSplunkTheme();
  const { colorScheme, canChooseColorScheme } = useAppThemeControls();
  const tilePagerHeight =
    Number.parseFloat(inputHeight) +
    Number.parseFloat(spacingXSmall) * 2 +
    Number.parseFloat(inputBorderWidth);
  const workspaceToggleRef = useRef<HTMLAnchorElement | HTMLButtonElement>(
    null,
  );
  useLayoutEffect(() => {
    document.documentElement.classList.add("scd-overview-active");
    document.body.classList.add("scd-overview-active");
    return () => {
      document.documentElement.classList.remove("scd-overview-active");
      document.body.classList.remove("scd-overview-active");
    };
  }, []);
  const [presentationMode, setPresentationMode] = useState(false);
  const togglePresentationMode = useCallback(() => {
    if (presentationMode) {
      setPresentationMode(false);
      if (document.fullscreenElement) {
        try {
          void document.exitFullscreen?.();
        } catch {
          // The CSS presentation fallback still exits immediately.
        }
      }
      return;
    }

    setPresentationMode(true);
    const root = document.getElementById("scan-root");
    if (!root) return;
    const requestFullscreen =
      root.requestFullscreen ??
      (
        root as HTMLElement & {
          webkitRequestFullscreen?: () => Promise<void>;
        }
      ).webkitRequestFullscreen;
    if (!requestFullscreen) return;
    try {
      const request = requestFullscreen.call(root);
      request?.catch(() => {
        // The fixed-position CSS fallback still hides Splunk chrome.
      });
    } catch {
      // The fixed-position CSS fallback still hides Splunk chrome.
    }
  }, [presentationMode]);

  useEffect(() => {
    document.documentElement.classList.toggle(
      "scd-presentation-mode",
      presentationMode,
    );
    document.body.classList.toggle("scd-presentation-mode", presentationMode);
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setPresentationMode(false);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.documentElement.classList.remove("scd-presentation-mode");
      document.body.classList.remove("scd-presentation-mode");
    };
  }, [presentationMode]);
  const availableDashboardHeight = useAvailableDashboardHeight();
  const compactDensity =
    availableDashboardHeight !== null &&
    availableDashboardHeight < COMPACT_HEIGHT_THRESHOLD_PX;
  const dashboardShellStyle = useMemo<React.CSSProperties>(
    () => ({
      colorScheme,
      height: presentationMode
        ? "100vh"
        : availableDashboardHeight !== null
          ? `${availableDashboardHeight}px`
          : "100vh",
    }),
    [availableDashboardHeight, colorScheme, presentationMode],
  );
  const workspaceSectionIds = useMemo(
    () => sectionIdsForWorkspace(insightsWorkspace),
    [insightsWorkspace],
  );
  const handleInsightsWorkspaceChange = useCallback(
    (nextWorkspaceId: WorkspaceId) => {
      if (
        nextWorkspaceId === insightsWorkspace.id ||
        typeof window === "undefined"
      ) {
        return;
      }
      const params = new URLSearchParams();
      params.set("workspace", nextWorkspaceId);
      window.location.assign(
        `${splunkViewAppUrl("workspace_insights")}?${params.toString()}`,
      );
    },
    [insightsWorkspace.id],
  );

  // ------------------------------ Shared workspace authoring ------------------------------
  const {
    canManageWorkspaces: canManageWorkspaceConfig,
    canManageSharedTopology,
    canManageFactoryTileConfig: canManageFactoryConfig,
  } = useInsightsWorkspacePermissions();
  const persistWorkspacePatch = useCallback(
    async (
      patch: Parameters<typeof toWorkspaceDefinitionInput>[1],
    ): Promise<InsightsWorkspace | null> => {
      if (!canManageWorkspaceConfig) return null;
      try {
        const saved = await saveInsightsWorkspace(
          toWorkspaceDefinitionInput(insightsWorkspace, patch),
          undefined,
          insightsWorkspace,
        );
        onWorkspaceUpdated?.(saved);
        return saved;
      } catch (error) {
        console.error("[insights] failed to save shared workspace", error);
        if (typeof window !== "undefined") {
          window.alert(
            error instanceof Error
              ? error.message
              : "Could not save this shared workspace.",
          );
        }
        return null;
      }
    },
    [canManageWorkspaceConfig, insightsWorkspace, onWorkspaceUpdated],
  );

  // ------------------------------ Branding ------------------------------
  //
  // Shared workspace configuration (`header_title` / `header_subtitle` /
  // `default_logo_src`) is the source of truth for every viewer. The header
  // pencil writes those fields through the workspace REST endpoint. Personal
  // localStorage branding is no longer applied on top of the shared title.
  //
  // `effectiveTitle` / `effectiveSubtitle` / `effectiveLogoSrc`
  // (derived below) collapse those layers into the strings the
  // JSX actually renders.
  const [logoSrc, setLogoSrc] = useState<string>(() =>
    insightsWorkspace.hideDefaultLogo
      ? ""
      : normalizeSharedImageSource(insightsWorkspace.defaultLogoSrc) ||
        DEFAULT_LOGO_DATA_URI,
  );
  const [appVersionLabel, setAppVersionLabel] =
    useState<string>(APP_VERSION_LABEL);
  const appCatalogUrl = secureNetworkingEssentialsCatalogUrl();
  const { resetAll: resetBrandingOverride } = useBrandingOverride(
    insightsWorkspace.id,
  );
  const [isBrandingEditorOpen, setBrandingEditorOpen] =
    useState<boolean>(false);
  const [isSectionTitlesEditorOpen, setSectionTitlesEditorOpen] =
    useState<boolean>(false);

  const effectiveTitle =
    insightsWorkspace.headerTitle ||
    insightsWorkspace.label ||
    DEFAULT_HEADER_TITLE_FALLBACK;
  const effectiveSubtitle =
    insightsWorkspace.headerSubtitle || DEFAULT_HEADER_SUBTITLE;
  // Logo precedence: explicit override (data URI from upload) →
  // current `logoSrc` (the workspace-specific packaged default, an
  // intentionally empty value, or the neutral built-in mark).
  // Header branding is intentionally independent from tile/layout
  // factory reset.
  const effectiveLogoSrc = normalizeSharedImageSource(logoSrc);

  useEffect(() => {
    setLogoSrc(
      insightsWorkspace.hideDefaultLogo
        ? ""
        : normalizeSharedImageSource(insightsWorkspace.defaultLogoSrc) ||
          DEFAULT_LOGO_DATA_URI,
    );
  }, [
    insightsWorkspace.defaultLogoSrc,
    insightsWorkspace.hideDefaultLogo,
    insightsWorkspace.id,
  ]);

  // ------------------------------ Time + refresh ------------------------------
  const [timeRange, setTimeRange] = useState<TimeRange>(
    () =>
      TIME_RANGE_OPTIONS.find((o) => o.label === DEFAULT_TIME_RANGE_LABEL) ??
      TIME_RANGE_OPTIONS[1],
  );
  const [selectedPriorityDrilldownView, setSelectedPriorityDrilldownView] =
    useState<string>(readPriorityDrilldownView);
  const selectedPriorityDrilldown = useMemo(
    () => getPriorityDrilldown(selectedPriorityDrilldownView),
    [selectedPriorityDrilldownView],
  );
  const featuredDrilldownHref = useMemo(
    () =>
      splunkViewAppUrl(
        selectedPriorityDrilldown.viewName,
        timeRange,
        selectedPriorityDrilldown.timeToken,
      ),
    [selectedPriorityDrilldown, timeRange],
  );
  const handlePriorityDrilldownChange = useCallback((viewName: string) => {
    const next = getPriorityDrilldown(viewName);
    setSelectedPriorityDrilldownView(next.viewName);
    writePriorityDrilldownView(next.viewName);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== PRIORITY_DRILLDOWN_STORAGE_KEY) return;
      setSelectedPriorityDrilldownView(readPriorityDrilldownView());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState<number>(0);
  const [refreshToken, setRefreshToken] = useState<number>(0);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(() => new Date());
  const refreshNow = useCallback(() => {
    setRefreshToken((n) => n + 1);
    setLastRefreshed(new Date());
  }, []);

  // ------------------------------ Section layout preference ------------------------------
  //
  // Factory shows the original three executive sections. Users can
  // hide sections they do not care about or reveal the fourth
  // optional section for a broader command-center layout.
  const {
    sections: visibleSections,
    availableSections,
    maxSections: maxVisibleSections,
    setSections: setVisibleSections,
    resetAll: resetAllSectionLayout,
  } = usePersistedSectionLayout({
    workspaceId: insightsWorkspace.id,
    availableSections: workspaceSectionIds,
    defaultSections: insightsWorkspace.defaultVisibleSections,
    maxSections: insightsWorkspace.maxVisibleSections,
  });

  // ------------------------------ Searchbase metadata ------------------------------
  // Loaded once at page mount and shared across the overview runtime.
  // `viz_options.overview` defines the factory tile catalogue; the
  // same record supplies literal SPL, friendly `search_name`, and
  // `dispatch_context`, so the tile browser, runtime dispatch, and
  // Open-in-Search all resolve through one central source of truth.
  //
  // `null` is the loading sentinel — tiles defer dispatch until Splunk
  // returns the conf records.
  const [searchbaseRecords, setSearchbaseRecords] = useState<
    SearchbaseRecord[] | null
  >(null);
  const [searchbaseByName, setSearchbaseByName] = useState<Map<
    string,
    SearchbaseRecord
  > | null>(null);
  const [searchbaseById, setSearchbaseById] = useState<Map<
    string,
    SearchbaseRecord
  > | null>(null);
  const [allSearchbaseRecords, setAllSearchbaseRecords] = useState<
    SearchbaseRecord[] | null
  >(null);

  // Bumped after an admin saves a Thresholds / Data Mapping /
  // Drilldown change (`searchbaseTileConfigService`) so the catalogue
  // re-fetches and the new admin-set values show up without a full
  // page reload. `saveFactoryTileConfig` already clears the
  // in-memory cache in `searchbaseCatalogue.ts`; this token just
  // re-runs the effect below to actually re-fetch.
  const [searchbaseRefreshToken, setSearchbaseRefreshToken] = useState(0);

  // Runtime dispatch intentionally includes `search_hidden = 1`
  // stanzas. Factory tiles and support drilldowns can be hidden from
  // pickers while still being valid runtime bindings.
  useEffect(() => {
    let cancelled = false;
    getSearchbaseCatalogue({ includeHidden: true })
      .then((list) => {
        if (cancelled) return;
        const byName = new Map<string, SearchbaseRecord>();
        const byId = new Map<string, SearchbaseRecord>();
        for (const entry of list) {
          if (entry.searchName) byName.set(entry.searchName, entry);
          if (entry.id) byId.set(entry.id, entry);
        }
        setSearchbaseRecords(list);
        setSearchbaseByName(byName);
        setSearchbaseById(byId);
      })
      .catch(() => {
        if (cancelled) return;
        setSearchbaseRecords([]);
        setSearchbaseByName(new Map());
        setSearchbaseById(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [searchbaseRefreshToken]);

  // The factory workspace remains bound to this app's catalogue, while the
  // add-search drawer can browse every installed Searchbase provider. Added
  // records are persisted with an app-qualified reference so same-named
  // stanzas from different apps never collide.
  useEffect(() => {
    let cancelled = false;
    getSearchbaseCatalogue({ allApps: true, includeHidden: true })
      .then((list) => {
        if (!cancelled) setAllSearchbaseRecords(list);
      })
      .catch(() => {
        if (!cancelled) setAllSearchbaseRecords([]);
      });
    return () => {
      cancelled = true;
    };
  }, [searchbaseRefreshToken]);

  const currentSearchbaseOwnerApp =
    searchbaseRecords?.find((record) => record.ownerApp)?.ownerApp ?? APP_NAME;

  const runtimeSearchbaseById = useMemo(() => {
    if (searchbaseById === null || allSearchbaseRecords === null) return null;
    const map = new Map(searchbaseById);
    for (const record of allSearchbaseRecords) {
      map.set(searchbaseRecordReference(record), record);
    }
    return map;
  }, [allSearchbaseRecords, searchbaseById]);

  const runtimeSearchbaseByName = useMemo(() => {
    if (searchbaseByName === null || allSearchbaseRecords === null) return null;
    const map = new Map(searchbaseByName);
    for (const record of allSearchbaseRecords) {
      map.set(
        searchbaseRecordNameReference(record.ownerApp, record.searchName),
        record,
      );
    }
    return map;
  }, [allSearchbaseRecords, searchbaseByName]);

  const {
    additions: sectionTileAdditions,
    getAdditions: getSectionTileAdditions,
    addTile: addSectionTile,
    removeTile: removeSectionTile,
    resetAll: resetAllSectionTileAdditions,
  } = usePersistedSectionTileAdditions({
    workspaceId: insightsWorkspace.id,
    availableSections,
  });
  const {
    isHidden: isSectionTileHidden,
    hideTile: hideSectionTile,
    showTile: showSectionTile,
    resetAll: resetAllSectionHiddenTiles,
  } = usePersistedSectionHiddenTiles({
    workspaceId: insightsWorkspace.id,
    availableSections,
  });

  // Shared additions are stored with the workspace layout; personal additions
  // remain scoped to this browser via usePersistedSectionTileAdditions.
  const [workspaceLayout, setWorkspaceLayout] =
    useState<WorkspaceLayoutConfig>(initialLayout);
  const [workspaceLayoutStatus, setWorkspaceLayoutStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const sharedSectionTileAdditions = useMemo<SectionTileAdditionMap>(() => {
    const additions: SectionTileAdditionMap = {};
    for (const section of availableSections) {
      const ids = workspaceLayout[section]?.searchbaseAdditions ?? [];
      if (ids.length > 0) additions[section] = ids;
    }
    return additions;
  }, [availableSections, workspaceLayout]);
  const effectiveSectionTileAdditions = useMemo<SectionTileAdditionMap>(() => {
    const additions: SectionTileAdditionMap = {};
    for (const section of availableSections) {
      const ids = [
        ...(sharedSectionTileAdditions[section] ?? []),
        ...(sectionTileAdditions[section] ?? []),
      ];
      if (ids.length > 0) additions[section] = Array.from(new Set(ids));
    }
    return additions;
  }, [availableSections, sectionTileAdditions, sharedSectionTileAdditions]);

  const baseMetricConfig = useMemo(
    () => buildOverviewMetricConfig(searchbaseRecords, insightsWorkspace),
    [insightsWorkspace, searchbaseRecords],
  );
  const addedMetricConfig = useMemo(
    () =>
      buildAddedOverviewMetricConfig(
        searchbaseRecords,
        allSearchbaseRecords,
        effectiveSectionTileAdditions,
        insightsWorkspace,
        baseMetricConfig,
      ),
    [
      baseMetricConfig,
      allSearchbaseRecords,
      insightsWorkspace,
      searchbaseRecords,
      effectiveSectionTileAdditions,
    ],
  );
  const metricConfig = useMemo(
    () => [...baseMetricConfig, ...addedMetricConfig],
    [addedMetricConfig, baseMetricConfig],
  );
  const renderMetricConfig = useMemo(
    () =>
      metricConfig.filter(
        (metric) => !isSectionTileHidden(metric.section, metric.id),
      ),
    [isSectionTileHidden, metricConfig],
  );
  const mapFooterKpiConfig = useMemo(
    () => buildOverviewMapFooterConfig(searchbaseRecords),
    [searchbaseRecords],
  );

  // ------------------------------ Shared workspace tile layout ------------------------------
  //
  // The searchbase overview metadata is the full tile catalogue. This
  // app-level config controls shared order, visible counts, and the explicit
  // Searchbase additions that belong to a workspace.
  const factoryTileCountDefaults = useMemo(() => {
    const out: Partial<Record<SectionId, number>> = {};
    for (const section of availableSections) {
      const count = workspaceLayout[section]?.visibleCount;
      if (typeof count === "number" && Number.isFinite(count)) {
        out[section] = count;
      }
    }
    return out;
  }, [availableSections, workspaceLayout]);

  const getFactoryTileOrder = useCallback(
    (section: SectionId, sectionMetrics: MetricConfig[]): string[] => {
      const canonicalIds = sectionMetrics.map((metric) => metric.id);
      const configuredIds = workspaceLayout[section]?.tiles ?? [];
      if (configuredIds.length === 0) return canonicalIds;

      const canonicalSet = new Set(canonicalIds);
      const seen = new Set<string>();
      const ordered: string[] = [];
      for (const id of configuredIds) {
        if (!canonicalSet.has(id) || seen.has(id)) continue;
        seen.add(id);
        ordered.push(id);
      }
      for (const id of canonicalIds) {
        if (seen.has(id)) continue;
        ordered.push(id);
      }
      return ordered;
    },
    [workspaceLayout],
  );

  // ------------------------------ Section tile-count preference ------------------------------
  //
  // Per-user, per-section "how many tiles do I want visible". The
  // user dials it via the small `−  N  +` pill on each section
  // header. The selected count is the page size; all configured
  // catalogue tiles remain reachable through paging or temporary show-all.
  // Trailing tiles are the ones that leave the first page when narrowing —
  // picker overrides on hidden tiles are NOT cleared, so a user
  // who customises tile #5, dials down to 3, then back up to 5,
  // gets their customisation back unchanged.
  //
  // Bounds come from the active workspace, with per-section defaults
  // from insights_workspaces.conf. Secure Networking ships
  // with three visible factory KPIs per section and an ordered catalogue of
  // nine; operators can save a different shared default from the picker
  // footer, and individual users can still dial the visible count up/down
  // with the section pill.
  // Returning users keep whatever count they had configured because
  // the per-section preference is keyed off localStorage.
  //
  // Declared up here (before the aggregate status block) because
  // the header health summary below needs to know which tiles are
  // currently visible.
  const {
    counts: sectionTileCounts,
    bounds: sectionTileBounds,
    setCount: setSectionTileCount,
    resetAll: resetAllSectionTileCounts,
  } = usePersistedSectionTileCounts({
    minCount: insightsWorkspace.minTileCount,
    maxCount: insightsWorkspace.maxTileCount,
    defaultCount: factoryTileCountDefaults,
    fallbackDefault: insightsWorkspace.fallbackTileCount,
    workspaceId: insightsWorkspace.id,
    availableSections,
  });

  // ------------------------------ Section height preference ------------------------------
  //
  // A companion to tile count and tile order. Some teams want one
  // section to act as the primary work surface for the day; the
  // height pill lets them give that section a taller chart canvas
  // without changing global topology config or removing other
  // sections.
  const {
    heights: sectionHeights,
    bounds: sectionHeightBounds,
    setHeight: setSectionHeight,
    resetAll: resetAllSectionHeights,
  } = usePersistedSectionHeights({
    minLevel: 1,
    maxLevel: 5,
    defaultLevel: 2,
    workspaceId: insightsWorkspace.id,
    availableSections,
  });

  // Collapsed state is a private, workspace-scoped preference. Focus is
  // deliberately transient: a reload always returns to the user's expanded /
  // collapsed layout instead of reopening an investigation-only view.
  const {
    collapsed: collapsedSections,
    setCollapsed: setSectionCollapsed,
    resetAll: resetAllSectionPresentation,
  } = usePersistedSectionPresentation({
    workspaceId: insightsWorkspace.id,
    availableSections,
  });
  const {
    concurrency: searchConcurrency,
    setConcurrency: setSearchConcurrency,
  } = usePersistedSearchConcurrency(insightsWorkspace.id);
  const [focusedSection, setFocusedSection] = useState<SectionId | null>(null);
  const [sectionTilePages, setSectionTilePages] = useState<
    Partial<Record<SectionId, number>>
  >({});
  const [showAllTileSections, setShowAllTileSections] = useState<
    Partial<Record<SectionId, boolean>>
  >({});

  useEffect(() => {
    setFocusedSection(null);
    setSectionTilePages({});
    setShowAllTileSections({});
  }, [insightsWorkspace.id]);

  const setSectionTilePage = useCallback((section: SectionId, page: number) => {
    setSectionTilePages((current) => ({
      ...current,
      [section]: Math.max(0, Math.round(page)),
    }));
  }, []);

  const toggleSectionShowAllTiles = useCallback((section: SectionId) => {
    setShowAllTileSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
    setSectionTilePages((current) => ({ ...current, [section]: 0 }));
  }, []);

  const changeSectionTileCount = useCallback(
    (section: SectionId, count: number) => {
      setSectionTileCount(section, count);
      setSectionTilePages((current) => ({ ...current, [section]: 0 }));
      setShowAllTileSections((current) => ({
        ...current,
        [section]: false,
      }));
    },
    [setSectionTileCount],
  );

  const toggleSectionFocus = useCallback((section: SectionId) => {
    setFocusedSection((current) => (current === section ? null : section));
  }, []);

  const toggleSectionCollapsed = useCallback(
    (section: SectionId) => {
      if (focusedSection === section) {
        setFocusedSection(null);
        setSectionCollapsed(section, true);
        return;
      }
      if (focusedSection && focusedSection !== section) {
        setFocusedSection(null);
        setSectionCollapsed(section, false);
        return;
      }
      setSectionCollapsed(section, !collapsedSections[section]);
    },
    [collapsedSections, focusedSection, setSectionCollapsed],
  );

  // ------------------------------ Section tile-order preference ------------------------------
  //
  // Companion to the count preference: the user can drag tiles
  // within a section to put their favourites first. Combined with
  // the count pill's trailing-hide rule, the user has full control
  // over which tiles appear and in what order.
  //
  // `getOrder(section, canonicalIds)` reconciles the persisted
  // order against the searchbase-backed catalogue on every read — renamed/removed
  // tiles drop out, new tiles are appended at the end so they
  // can't bump the user's chosen top tiles out of view when a
  // release ships.
  const {
    getOrder: getSectionTileOrder,
    setOrder: setSectionTileOrder,
    resetAll: resetAllSectionTileOrder,
  } = usePersistedSectionTileOrder({
    workspaceId: insightsWorkspace.id,
    availableSections,
  });

  // Drag sensors:
  //   * PointerSensor with a small activationConstraint so a click
  //     on the grip handle that doesn't move (e.g., a missed drag
  //     attempt) doesn't accidentally trigger reordering.
  //   * KeyboardSensor for users who navigate by keyboard — the
  //     `sortableKeyboardCoordinates` helper translates arrow
  //     keys into drag deltas that respect the sortable layout.
  const dndSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // ------------------------------ Aggregate status ------------------------------
  const [statuses, setStatuses] = useState<Record<string, MetricStatus>>({});
  const reportStatus = useCallback((id: string, s: MetricStatus) => {
    setStatuses((prev) => (prev[id] === s ? prev : { ...prev, [id]: s }));
  }, []);

  // The header health summary should only reflect tiles the user is
  // currently *seeing*. When a tile is hidden (because the user
  // dialled the section count down), its last reported status
  // would otherwise stick around in `statuses` and skew the
  // aggregate. Recompute the visible-tile id set whenever the
  // per-section count, page, or temporary show-all state changes and
  // use it as the gate both for the badge and (below) for the section render.
  const visibleMetricIds = useMemo(() => {
    const out = new Set<string>();
    for (const section of visibleSections) {
      // Same pipeline the render below uses: canonical ids ->
      // apply user reorder -> clamp to the workspace catalogue ->
      // apply the active page or temporary show-all state. Keeping
      // the summary filter and the render in lockstep means a
      // tile dragged into the visible window also gets its
      // status counted in the aggregate, and a tile dragged
      // out is dropped immediately.
      const sectionMetrics = renderMetricConfig.filter(
        (m) => m.section === section,
      );
      const canonicalIds = getFactoryTileOrder(section, sectionMetrics);
      const orderedIds = getSectionTileOrder(section, canonicalIds);
      const sectionMaxAvailable = Math.min(
        sectionTileBounds.maxCount,
        orderedIds.length,
      );
      const catalogueIds = orderedIds.slice(0, sectionMaxAvailable);
      const visibleCount = Math.min(
        sectionTileCounts[section],
        sectionMaxAvailable,
      );
      if (visibleCount <= 0) continue;
      const pageCount = meaningfulTilePageCount(
        sectionMaxAvailable,
        visibleCount,
        Math.min(sectionTileBounds.minCount, sectionMaxAvailable),
      );
      const page = Math.min(sectionTilePages[section] ?? 0, pageCount - 1);
      const showingAll = Boolean(showAllTileSections[section]);
      const start = showingAll ? 0 : page * visibleCount;
      const visible = showingAll
        ? catalogueIds
        : catalogueIds.slice(start, start + visibleCount);
      for (const id of visible) out.add(id);
    }
    return out;
  }, [
    visibleSections,
    sectionTileCounts,
    sectionTileBounds.maxCount,
    sectionTilePages,
    showAllTileSections,
    renderMetricConfig,
    getFactoryTileOrder,
    getSectionTileOrder,
  ]);

  const statusList = useMemo(
    () =>
      Object.entries(statuses)
        .filter(([id]) => visibleMetricIds.has(id))
        .map(([, s]) => s),
    [statuses, visibleMetricIds],
  );

  const headerHealthSummary = useMemo(() => {
    const counts = statusList.reduce(
      (summary, status) => {
        summary[status] += 1;
        return summary;
      },
      { critical: 0, warning: 0, healthy: 0, unknown: 0 },
    );
    if (counts.critical || counts.warning) {
      return [
        counts.critical ? `${counts.critical} critical` : "",
        counts.warning ? `${counts.warning} warning` : "",
      ]
        .filter(Boolean)
        .join(" · ");
    }
    if (counts.healthy) return "All systems operational";
    return "Awaiting metrics";
  }, [statusList]);

  // ------------------------------ Help overlay ------------------------------
  const [helpOpen, setHelpOpen] = useState(false);
  const helpReturnFocusRef = useRef<HTMLElement | null>(null);
  const [headerActionsOpen, setHeaderActionsOpen] = useState(false);
  const headerActionsToggleRef = useRef<HTMLAnchorElement | HTMLButtonElement>(
    null,
  );
  const closeHeaderActions = useCallback((restoreFocus = true) => {
    setHeaderActionsOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() =>
        headerActionsToggleRef.current?.focus(),
      );
    }
  }, []);

  const [visibleSearchbaseCatalogue, setVisibleSearchbaseCatalogue] = useState<
    SearchbaseRecord[] | null
  >(null);
  const [
    signalTickerIncludeHiddenSearches,
    setSignalTickerIncludeHiddenSearches,
  ] = useState(false);
  const [
    signalTickerIncludeDrilldownSearches,
    setSignalTickerIncludeDrilldownSearches,
  ] = useState(false);
  const [
    signalTickerIncludeTableSearches,
    setSignalTickerIncludeTableSearches,
  ] = useState(false);
  const [
    signalTickerDrilldownSearchNames,
    setSignalTickerDrilldownSearchNames,
  ] = useState<Set<string> | null>(null);
  useEffect(() => {
    let cancelled = false;
    setVisibleSearchbaseCatalogue(null);
    getSearchbaseCatalogue(
      signalTickerIncludeHiddenSearches
        ? { allApps: true, includeHidden: true }
        : { allApps: true },
    )
      .then((list) => {
        if (cancelled) return;
        setVisibleSearchbaseCatalogue(list);
      })
      .catch(() => {
        if (!cancelled) setVisibleSearchbaseCatalogue([]);
      });
    return () => {
      cancelled = true;
    };
  }, [signalTickerIncludeHiddenSearches]);
  useEffect(() => {
    let cancelled = false;
    getSearchbaseCatalogue({ allApps: true, includeHidden: true })
      .then((list) => {
        if (cancelled) return;
        const drilldownNames = new Set<string>();
        for (const entry of list) {
          for (const rawName of entry.drilldownSearchNames ?? []) {
            const name = rawName.trim();
            if (name) drilldownNames.add(name);
          }
        }
        setSignalTickerDrilldownSearchNames(drilldownNames);
      })
      .catch(() => {
        if (!cancelled) setSignalTickerDrilldownSearchNames(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ------------------------------ Signal rail ------------------------------
  // Shared KPI membership lives in insights_workspaces.conf. Personal
  // preferences only keep display speed, density, and type size.
  const persistSharedSignalRail = useCallback(
    async (config: SignalTickerConfig) => {
      const sharedConfig: SignalTickerConfig = {
        ...config,
        speed: signalTickerDefault.speed,
        density: signalTickerDefault.density,
        fontSize: signalTickerDefault.fontSize,
      };
      await saveWorkspaceSignalRail(insightsWorkspace, sharedConfig);
      onSignalRailUpdated?.(insightsWorkspace.id, sharedConfig);
    },
    [insightsWorkspace, onSignalRailUpdated, signalTickerDefault],
  );
  const {
    config: signalTickerConfig,
    setConfig: setSignalTickerConfig,
    resetAll: resetSignalTickerConfig,
    isWorkspaceDefault: signalTickerIsWorkspaceDefault,
    persistenceStatus: signalTickerPersistenceStatus,
    persistenceError: signalTickerPersistenceError,
  } = usePersistedSignalTicker(
    insightsWorkspace.id,
    signalTickerDefault,
    canManageWorkspaceConfig ? persistSharedSignalRail : undefined,
  );
  const [signalTickerEditorOpen, setSignalTickerEditorOpen] = useState(false);
  const searchbaseCatalogue = useMemo(() => {
    if (!visibleSearchbaseCatalogue) return [];
    const fallbackDrilldownNames = new Set<string>();
    for (const entry of visibleSearchbaseCatalogue) {
      for (const rawName of entry.drilldownSearchNames ?? []) {
        const name = rawName.trim();
        if (name) fallbackDrilldownNames.add(name);
      }
    }
    const drilldownNames =
      signalTickerDrilldownSearchNames ?? fallbackDrilldownNames;
    return visibleSearchbaseCatalogue
      .filter((entry) => {
        const isDrilldownSearch =
          drilldownNames.has(entry.id) || drilldownNames.has(entry.searchName);
        const isTableSearch =
          entry.defaultViz?.trim().toLowerCase() === "splunk.table";
        return (
          (signalTickerIncludeDrilldownSearches || !isDrilldownSearch) &&
          (signalTickerIncludeTableSearches || !isTableSearch)
        );
      })
      .sort((a, b) => a.searchName.localeCompare(b.searchName));
  }, [
    signalTickerDrilldownSearchNames,
    signalTickerIncludeDrilldownSearches,
    signalTickerIncludeTableSearches,
    visibleSearchbaseCatalogue,
  ]);

  // ------------------------------ Regional view (map | table) ------------------------------
  const [regionalView, setRegionalView] = useState<RegionalView>(
    insightsWorkspace.regionalView,
  );

  // ------------------------------ Map position (right / below / above) ------------------------------
  // Where the topology map sits relative to the metric tiles. Default
  // is `right` (per the 2026-05-13 review): the topology map is the
  // executive's anchor visual, so it lives on the right where the eye
  // returns after scanning the metric rails on the left. Build 83
  // pairs this with a tighter map column (≈1/3 of the width — see
  // `SPLIT_DEFAULT` below) so the metric tiles still get 2/3 of the
  // viewport for headline KPIs.
  //
  // Earlier revisions defaulted to `below` because the original
  // right-side-only layout fought for horizontal width on
  // 1280-1440px displays. That concern is addressed by the new
  // 66.67% tile / 33.33% map split, which keeps tile headlines
  // legible at 1280px while still giving the map enough room for
  // region labels.
  //
  // `right` is the side-by-side split-pane (draggable vertical
  // splitter); `below` stacks tiles-on-top + map-below; `above`
  // stacks the other way for operators who treat the map as the
  // primary view.
  //
  // Declared *above* the layout-split block because the drag and
  // keyboard handlers below need to read this value to decide which
  // axis to operate on.
  //
  // Persisted in localStorage so the operator's preference survives
  // reloads, cleared by the factory reset alongside the splitter
  // position.
  // Map placement and visibility are workspace-owned so every viewer sees
  // the layout an administrator publishes. Split percentage and map height
  // remain personal view preferences.
  const [mapPosition, setMapPosition] = useState<MapPosition>(
    insightsWorkspace.mapPosition,
  );
  const MAP_POS_KEY = userScopedStorageKey(
    `scd_overview_map_pos.${insightsWorkspace.id}`,
  );
  const MAP_VISIBILITY_KEY = userScopedStorageKey(
    `scd_overview_map_visible.${insightsWorkspace.id}`,
  );
  const [mapVisible, setMapVisible] = useState<boolean>(
    insightsWorkspace.mapVisible,
  );
  const MAP_HEIGHT_KEY = userScopedStorageKey(
    `scd_overview_map_height.${insightsWorkspace.id}`,
  );
  const MAP_HEIGHT_DEFAULT: MapHeightMode = "compact";
  const [mapHeightMode, setMapHeightMode] = useState<MapHeightMode>(() => {
    if (typeof window === "undefined") return MAP_HEIGHT_DEFAULT;
    try {
      const saved = readUserScopedStorageItem(MAP_HEIGHT_KEY);
      return saved === "match-workspace" || saved === "compact"
        ? saved
        : MAP_HEIGHT_DEFAULT;
    } catch {
      return MAP_HEIGHT_DEFAULT;
    }
  });
  const mapHeightStorageKeyRef = useRef(MAP_HEIGHT_KEY);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (mapHeightStorageKeyRef.current !== MAP_HEIGHT_KEY) {
        mapHeightStorageKeyRef.current = MAP_HEIGHT_KEY;
        const saved = readUserScopedStorageItem(MAP_HEIGHT_KEY);
        setMapHeightMode(
          saved === "match-workspace" || saved === "compact"
            ? saved
            : MAP_HEIGHT_DEFAULT,
        );
        return;
      }
      window.localStorage.setItem(MAP_HEIGHT_KEY, mapHeightMode);
    } catch {
      // Storage unavailable; the height choice still applies for this session.
    }
  }, [MAP_HEIGHT_KEY, mapHeightMode]);
  useEffect(() => {
    setRegionalView(insightsWorkspace.regionalView);
    setMapPosition(insightsWorkspace.mapPosition);
    setMapVisible(insightsWorkspace.mapVisible);
  }, [
    insightsWorkspace.id,
    insightsWorkspace.mapPosition,
    insightsWorkspace.mapVisible,
    insightsWorkspace.regionalView,
  ]);
  const activeMapPosition: MapPosition | "hidden" = mapVisible
    ? mapPosition
    : "hidden";
  const updateMapLayout = useCallback(
    (next: MapLayout) => {
      const nextVisible = next !== "hidden";
      const nextPosition = next === "hidden" ? mapPosition : next;
      if (next === "hidden") {
        setMapVisible(false);
      } else {
        setMapPosition(next);
        setMapVisible(true);
      }
      void persistWorkspacePatch({
        mapVisible: nextVisible,
        mapPosition: nextPosition,
      });
    },
    [mapPosition, persistWorkspacePatch],
  );
  const updateRegionalView = useCallback(
    (next: RegionalView) => {
      setRegionalView(next);
      void persistWorkspacePatch({ regionalView: next });
    },
    [persistWorkspacePatch],
  );
  // Convenience flag for the drag / keyboard handlers and the
  // splitter styling: `right` mode drags on the X axis, `below` /
  // `above` modes drag on the Y axis.
  const isVerticalSplit = mapVisible && mapPosition !== "right";

  // ------------------------------ Layout split (tiles ↔ map) ------------------------------
  // Percentage of the container allocated to the tile column,
  // regardless of layout mode. In `right` mode the splitter is the
  // thin vertical handle between the two side-by-side columns — drag
  // it left to widen the map, right to widen the tiles. In `below` /
  // `above` modes the same percentage controls vertical share: drag
  // the horizontal handle up/down to rebalance heights. (In `above`
  // mode the axis is inverted because tiles sit at the visual bottom
  // — see `onMove` below.) Default 58.33% matches the previous fixed
  // 7-of-12 grid so the page boots identically until the user
  // reaches for the handle. Persisted to localStorage so the
  // operator's preference survives reloads.
  //
  // Clamped 35–80% to keep both columns usable: below 35% and the
  // tiles can't even fit one row of headlines without truncating;
  // above 80% and the map collapses to a slim band that's hard to
  // read region labels on. The same range applies vertically — at
  // 35% map (= 65% tiles) the map height drops to ~280px on a
  // standard 1080p display, which is the bottom of "still useful".
  //
  // Default 66.67% (Build 83): metrics get 2/3 of the width, map
  // gets 1/3. Pairs with the shared workspace default of `right` to put the
  // headline KPI rails on the left and the topology map as the
  // anchor visual on the right at boot. Earlier revisions used
  // 58.33% (= 7/12, matching the legacy fixed grid), but that left
  // the map column too wide for an exec view where the metrics are
  // the primary read.
  const SPLIT_KEY = userScopedStorageKey("scd_overview_split_pct");
  const SPLIT_DEFAULT = 66.67;
  const SPLIT_MIN = 35;
  const SPLIT_MAX = 80;
  const [leftPct, setLeftPct] = useState<number>(() => {
    if (typeof window === "undefined") return SPLIT_DEFAULT;
    try {
      const saved = readUserScopedStorageItem(SPLIT_KEY);
      const n = saved ? Number(saved) : NaN;
      return Number.isFinite(n) && n >= SPLIT_MIN && n <= SPLIT_MAX
        ? n
        : SPLIT_DEFAULT;
    } catch {
      return SPLIT_DEFAULT;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(SPLIT_KEY, String(leftPct));
    } catch {
      // localStorage may be disabled (private mode / quota); the
      // split still works for the session, we just can't
      // persist it. No-op rather than spamming console.errors.
    }
  }, [leftPct]);

  // While the splitter is being dragged, every mousemove updates the
  // percentage. We keep the handler attached to the window (not the
  // splitter element) so the drag survives the cursor leaving the
  // 4px-wide handle — same UX pattern as VS Code panel resizers.
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const beginDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);
  useEffect(() => {
    if (!dragging) return undefined;
    const onMove = (ev: MouseEvent) => {
      const el = splitContainerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      let pct: number;
      if (mapPosition === "right") {
        if (rect.width <= 0) return;
        pct = ((ev.clientX - rect.left) / rect.width) * 100;
      } else {
        if (rect.height <= 0) return;
        // Raw pct is the splitter's vertical position as a
        // fraction of container height (0 = top edge, 100 =
        // bottom edge). In `below` mode the tiles occupy the
        // top portion, so that *is* the tiles' share. In
        // `above` mode the layout is flex-col-reverse — tiles
        // sit at the visual bottom — so the share is inverted.
        const rawPct = ((ev.clientY - rect.top) / rect.height) * 100;
        pct = mapPosition === "above" ? 100 - rawPct : rawPct;
      }
      const clamped = Math.max(SPLIT_MIN, Math.min(SPLIT_MAX, pct));
      setLeftPct(clamped);
    };
    const onUp = () => setDragging(false);
    // Lock the cursor and suppress text-selection while dragging.
    // Without this the cursor flickers between resize and the
    // default arrow as the pointer crosses tile boundaries, and
    // sustained drags accidentally select metric labels. The axis
    // matches the splitter orientation so the locked cursor lines
    // up with what the user is actually doing.
    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor = isVerticalSplit ? "row-resize" : "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevUserSelect;
    };
  }, [dragging, mapPosition, isVerticalSplit]);
  // Keyboard nudge: arrow keys ±1, Shift+arrow ±5. Double-click
  // restores the default split. Both make the handle keyboard- and
  // touch-friendly without hijacking page-level shortcuts.
  //
  // The arrow key axis follows the splitter orientation so the
  // visual mental model holds: pressing the arrow in a direction
  // always moves the splitter line in that direction.
  //   - `right` mode: ←/→ adjust tiles' width share directly.
  //   - `below` mode: ↑ shrinks tiles (top section), ↓ grows them.
  //   - `above` mode: tiles sit at the bottom, so ↑ *grows* them
  //     (the splitter rises into map territory) and ↓ shrinks them.
  // Home / End always snap to the min / max share for the tiles
  // regardless of orientation — they're "first / last" semantics,
  // not directional.
  const onSplitterKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 5 : 1;
      const clamp = (p: number) => Math.max(SPLIT_MIN, Math.min(SPLIT_MAX, p));
      if (mapPosition === "right") {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          setLeftPct((p) => clamp(p - step));
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          setLeftPct((p) => clamp(p + step));
        }
      } else {
        // `above` inverts the axis (see onMove comment).
        const sign = mapPosition === "above" ? -1 : 1;
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setLeftPct((p) => clamp(p - sign * step));
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          setLeftPct((p) => clamp(p + sign * step));
        }
      }
      if (e.key === "Home") {
        e.preventDefault();
        setLeftPct(SPLIT_MIN);
      } else if (e.key === "End") {
        e.preventDefault();
        setLeftPct(SPLIT_MAX);
      }
    },
    [SPLIT_MIN, SPLIT_MAX, mapPosition],
  );
  const resetSplit = useCallback(() => setLeftPct(SPLIT_DEFAULT), []);
  const verticalMapMinHeight = compactDensity
    ? VERTICAL_MAP_COMPACT_MIN_HEIGHT_PX
    : VERTICAL_MAP_MIN_HEIGHT_PX;
  const verticalMetricsMinHeight = compactDensity
    ? VERTICAL_METRICS_COMPACT_MIN_HEIGHT_PX
    : VERTICAL_METRICS_MIN_HEIGHT_PX;
  const verticalMetricsStyle = useMemo<React.CSSProperties | undefined>(
    () =>
      isVerticalSplit
        ? {
            flexBasis: `${leftPct}%`,
            flexGrow: 0,
            flexShrink: 1,
            minHeight: verticalMetricsMinHeight,
          }
        : undefined,
    [isVerticalSplit, leftPct, verticalMetricsMinHeight],
  );
  const verticalMapStyle = useMemo<React.CSSProperties | undefined>(
    () =>
      isVerticalSplit
        ? {
            minHeight: `min(${verticalMapMinHeight}px, calc(100% - ${verticalMetricsMinHeight}px))`,
          }
        : undefined,
    [isVerticalSplit, verticalMapMinHeight, verticalMetricsMinHeight],
  );
  const firstVisibleSectionMinHeight = useMemo(() => {
    const section = visibleSections[0];
    if (!section) return verticalMetricsMinHeight;
    const sectionMetricCount = renderMetricConfig.filter(
      (metric) => metric.section === section,
    ).length;
    const sectionMaxAvailable = Math.min(
      sectionTileBounds.maxCount,
      sectionMetricCount,
    );
    const visibleCount = Math.min(
      sectionTileCounts[section],
      sectionMaxAvailable,
    );
    const isShowingAllTiles =
      Boolean(showAllTileSections[section]) &&
      sectionMaxAvailable > visibleCount;
    const renderedTileCount = isShowingAllTiles
      ? sectionMaxAvailable
      : visibleCount;
    const pageCount = meaningfulTilePageCount(
      sectionMaxAvailable,
      visibleCount,
      Math.min(sectionTileBounds.minCount, sectionMaxAvailable),
    );
    const estimatedTileRows =
      renderedTileCount >= SECTION_WRAP_TILE_COUNT
        ? Math.ceil(renderedTileCount / SECTION_WRAPPED_TILE_COLUMNS)
        : 1;
    const heightLevel =
      sectionHeights[section] ?? sectionHeightBounds.defaultLevel;
    const isCompactHeight = heightLevel === sectionHeightBounds.minLevel;
    const baseMinHeight = isCompactHeight
      ? SECTION_HEIGHT_H1_BASE_PX
      : compactDensity
        ? SECTION_HEIGHT_COMPACT_BASE_PX
        : SECTION_HEIGHT_BASE_PX;
    const wrappedRowStep = isCompactHeight
      ? SECTION_WRAPPED_H1_TILE_ROW_STEP_PX
      : SECTION_WRAPPED_TILE_ROW_STEP_PX;
    return Math.max(
      verticalMetricsMinHeight,
      baseMinHeight +
        (heightLevel - sectionHeightBounds.minLevel) * SECTION_HEIGHT_STEP_PX +
        (estimatedTileRows - 1) * wrappedRowStep +
        (isShowingAllTiles || pageCount > 1 ? tilePagerHeight : 0),
    );
  }, [
    compactDensity,
    sectionHeightBounds.defaultLevel,
    sectionHeightBounds.minLevel,
    sectionHeights,
    sectionTileBounds.maxCount,
    sectionTileCounts,
    showAllTileSections,
    tilePagerHeight,
    renderMetricConfig,
    verticalMetricsMinHeight,
    visibleSections,
  ]);
  const splitStyle = useMemo(
    () =>
      ({
        "--scd-left-pct": `${leftPct}%`,
        ...(isVerticalSplit
          ? {
              minHeight:
                verticalMapMinHeight +
                firstVisibleSectionMinHeight +
                VERTICAL_SPLIT_CHROME_ALLOWANCE_PX,
            }
          : null),
      }) as React.CSSProperties,
    [
      firstVisibleSectionMinHeight,
      isVerticalSplit,
      leftPct,
      verticalMapMinHeight,
    ],
  );

  // ------------------------------ Export ------------------------------
  const exportRef = useRef<HTMLDivElement>(null);
  const { exporting, exportAs } = useExportPage({
    targetRef: exportRef,
    fileName: "overview",
  });

  // ------------------------------ Auto-refresh timer ------------------------------
  useEffect(() => {
    if (autoRefreshSeconds <= 0) return undefined;
    const id = window.setInterval(() => {
      refreshNow();
    }, autoRefreshSeconds * 1000);
    return () => window.clearInterval(id);
  }, [autoRefreshSeconds, refreshNow]);

  // ------------------------------ Installed app identity fetch ------------------------------
  // The package step stamps the release build into the installed app.conf
  // after webpack has compiled the bundle. Prefer that live value so the
  // operator sees the version/build Splunk is actually running. Retain the
  // compile-time label as a resilient fallback when the endpoint is unavailable.
  // The shared executive_insights_bootstrap.js owns the update badge so both
  // workspace shells get the same update check and direct app-installer link.
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    let cancelled = false;

    fetch(
      `${splunkLocalePrefix()}/splunkd/__raw/services/apps/local/${encodeURIComponent(APP_NAME)}?output_mode=json`,
      {
        credentials: "include",
        headers: { Accept: "application/json" },
      },
    )
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{
          entry?: Array<{ content?: Record<string, unknown> }>;
        }>;
      })
      .then((json) => {
        if (cancelled) return;
        const content = json.entry?.[0]?.content ?? {};
        const { version } = resolveAppVersions({
          installedVersion: content.version,
        });
        const build =
          typeof content.build === "string" || typeof content.build === "number"
            ? String(content.build).trim()
            : "";
        if (version) {
          setAppVersionLabel(`v${version}${build ? ` · Build ${build}` : ""}`);
        }
      })
      .catch(() => {
        // Keep the compile-time label when app metadata is unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // ------------------------------ Metric / KPI overrides (picker) ------------------------------
  //
  // Each tile stores its (optional) override under its `id`. The
  // picker writes via `setOverride` and the gear icons read out of
  // the same map so the customised dot stays in sync. Reset wipes
  // every override and brings the dashboard back to the static
  // config defined in this file.
  const {
    overrides,
    setOverride,
    clearOverride,
    resetAll: resetAllOverrides,
    overrideCount,
  } = usePersistedMetricOverrides(insightsWorkspace.id);
  const signalTickerMetricDefaults = useMemo(() => {
    const toDefault = (cfg: MetricConfig): SignalTickerMetricDefaults => ({
      label: cfg.label,
      subLabel: cfg.subLabel,
      description: cfg.description,
      valueField: cfg.valueField,
      displayField: cfg.displayField,
      sparkDataField: cfg.sparkDataField,
      baselineField: cfg.baselineField,
      overlayLabel: cfg.overlayLabel,
      changeField: cfg.changeField,
      comparePeriod: cfg.comparePeriod,
      unit: cfg.unit,
      color: cfg.color,
      thresholds: cfg.thresholds,
    });
    // Search binding is admin-controlled now, so `cfg` is already
    // the effective value — no override to layer on top.
    const map = new Map<string, SignalTickerMetricDefaults>();
    for (const cfg of metricConfig) {
      if (cfg.savedSearch) map.set(cfg.savedSearch, toDefault(cfg));
    }
    return map;
  }, [metricConfig]);
  const {
    drilldowns: searchbaseDrilldowns,
    resetAll: resetAllSearchbaseDrilldowns,
  } = usePersistedSearchbaseDrilldowns(insightsWorkspace.id);
  const [pickerContext, setPickerContext] = useState<KpiPickerContext | null>(
    null,
  );
  const pickerReturnFocusRef = useRef<HTMLElement | null>(null);
  const [addTileSection, setAddTileSection] = useState<SectionId | null>(null);
  const [lastAddTileSection, setLastAddTileSection] =
    useState<SectionId | null>(null);
  const addTileReturnFocusRef = useRef<HTMLElement | null>(null);
  const [activeDetailTable, setActiveDetailTable] =
    useState<MetricDetailTableConfig | null>(null);

  const closeAddTilePicker = useCallback(() => setAddTileSection(null), []);

  const handleAddSearchToSection = useCallback(
    async (
      section: SectionId,
      record: SearchbaseRecord,
      destination: "personal" | "workspace",
    ) => {
      if (!record.id) return;
      const recordReference = searchbaseRecordReference(record);
      if (destination === "workspace" && !canManageWorkspaceConfig) {
        window.alert(
          "You do not have permission to change this shared workspace.",
        );
        return;
      }
      const sectionMetrics = metricConfig.filter((m) => m.section === section);
      const visibleSectionMetrics = renderMetricConfig.filter(
        (m) => m.section === section,
      );
      const canonicalIds = getFactoryTileOrder(section, visibleSectionMetrics);
      const orderedIds = getSectionTileOrder(section, canonicalIds);
      const sectionMaxAvailable = Math.min(
        sectionTileBounds.maxCount,
        orderedIds.length,
      );
      const configuredMetricIds = new Set(
        orderedIds.slice(0, sectionMaxAvailable),
      );
      const currentSearchbaseIds = new Set(
        visibleSectionMetrics
          .filter((metric) => configuredMetricIds.has(metric.id))
          .map((metric) => metric.searchbaseId)
          .filter((id): id is string => Boolean(id)),
      );
      if (
        Array.from(currentSearchbaseIds).some((reference) =>
          searchbaseReferenceMatchesRecord(
            reference,
            record,
            currentSearchbaseOwnerApp,
          ),
        )
      ) {
        return;
      }

      const currentVisibleCount = Math.min(
        sectionTileCounts[section],
        Math.min(sectionTileBounds.maxCount, visibleSectionMetrics.length),
      );

      const existingMetric = sectionMetrics.find((metric) =>
        searchbaseReferenceMatchesRecord(
          metric.searchbaseId,
          record,
          currentSearchbaseOwnerApp,
        ),
      );
      const newTileId =
        existingMetric?.id ?? overviewAdditionTileId(section, recordReference);
      const nextOrder = orderedIds.filter((id) => id !== newTileId);
      const insertAt =
        currentVisibleCount >= sectionTileBounds.maxCount
          ? Math.max(0, currentVisibleCount - 1)
          : Math.min(currentVisibleCount, nextOrder.length);
      nextOrder.splice(insertAt, 0, newTileId);

      const nextVisibleCount = Math.min(
        sectionTileBounds.maxCount,
        currentVisibleCount + 1,
        visibleSectionMetrics.length + (existingMetric ? 0 : 1),
      );
      const applyPersonalViewState = () => {
        setSectionTileOrder(section, nextOrder);
        changeSectionTileCount(section, nextVisibleCount);
      };
      if (destination === "personal") {
        applyPersonalViewState();
        if (!existingMetric) addSectionTile(section, recordReference);
        return;
      }

      const currentSharedAdditions =
        workspaceLayout[section]?.searchbaseAdditions ?? [];
      const nextSectionLayout = {
        ...(workspaceLayout[section] ?? { tiles: [] }),
        tiles: nextOrder,
        visibleCount: nextVisibleCount,
        searchbaseAdditions: Array.from(
          new Set([
            ...currentSharedAdditions,
            ...(existingMetric ? [] : [recordReference]),
          ]),
        ),
      };
      const nextLayout: WorkspaceLayoutConfig = {
        ...workspaceLayout,
        [section]: nextSectionLayout,
      };
      setWorkspaceLayoutStatus("saving");
      try {
        await saveWorkspaceLayout(
          insightsWorkspace,
          {
            [section]: nextSectionLayout,
          },
          workspaceLayout,
        );
        setWorkspaceLayout(nextLayout);
        applyPersonalViewState();
        setWorkspaceLayoutStatus("saved");
        window.setTimeout(() => setWorkspaceLayoutStatus("idle"), 2400);
      } catch (error) {
        console.error("[insights] failed to add shared workspace tile", error);
        setWorkspaceLayoutStatus("error");
        window.alert(
          error instanceof Error
            ? error.message
            : "Could not add this search to the shared workspace.",
        );
        window.setTimeout(() => setWorkspaceLayoutStatus("idle"), 4000);
      }
    },
    [
      addSectionTile,
      canManageWorkspaceConfig,
      currentSearchbaseOwnerApp,
      getFactoryTileOrder,
      getSectionTileOrder,
      insightsWorkspace,
      metricConfig,
      renderMetricConfig,
      sectionTileBounds.maxCount,
      sectionTileCounts,
      changeSectionTileCount,
      setSectionTileOrder,
      workspaceLayout,
    ],
  );

  const removeAddedSearchbaseIdFromSection = useCallback(
    (section: SectionId, searchbaseId: string) => {
      if (!searchbaseId) return;
      const tileId = overviewAdditionTileId(section, searchbaseId);
      const sectionMetrics = metricConfig.filter((m) => m.section === section);
      const canonicalIds = getFactoryTileOrder(section, sectionMetrics);
      const orderedIds = getSectionTileOrder(section, canonicalIds);

      removeSectionTile(section, searchbaseId);
      showSectionTile(section, tileId);
      clearOverride(tileId);
      setSectionTileOrder(
        section,
        orderedIds.filter((id) => id !== tileId),
      );
      setStatuses((prev) => {
        if (!(tileId in prev)) return prev;
        const next = { ...prev };
        delete next[tileId];
        return next;
      });
    },
    [
      clearOverride,
      getFactoryTileOrder,
      getSectionTileOrder,
      metricConfig,
      removeSectionTile,
      setSectionTileOrder,
      showSectionTile,
    ],
  );

  const handleRemoveAddedSearchFromSection = useCallback(
    (section: SectionId, record: SearchbaseRecord) => {
      const persistedReference = getSectionTileAdditions(section).find(
        (reference) =>
          searchbaseReferenceMatchesRecord(
            reference,
            record,
            currentSearchbaseOwnerApp,
          ),
      );
      if (persistedReference) {
        removeAddedSearchbaseIdFromSection(section, persistedReference);
      }
    },
    [
      currentSearchbaseOwnerApp,
      getSectionTileAdditions,
      removeAddedSearchbaseIdFromSection,
    ],
  );

  const handleRemoveSharedSearchFromSection = useCallback(
    async (section: SectionId, record: SearchbaseRecord) => {
      if (!canManageWorkspaceConfig) {
        throw new Error(
          "You do not have permission to change this shared workspace.",
        );
      }
      const currentSectionLayout = workspaceLayout[section];
      if (!currentSectionLayout) return;
      const currentAdditions = currentSectionLayout.searchbaseAdditions ?? [];
      const persistedReference = currentAdditions.find((reference) =>
        searchbaseReferenceMatchesRecord(
          reference,
          record,
          currentSearchbaseOwnerApp,
        ),
      );
      if (!persistedReference) return;
      const nextAdditions = currentAdditions.filter(
        (reference) => reference !== persistedReference,
      );
      if (nextAdditions.length === currentAdditions.length) {
        return;
      }

      const tileId = overviewAdditionTileId(section, persistedReference);
      const nextTiles = currentSectionLayout.tiles.filter(
        (id) => id !== tileId,
      );
      const nextSectionLayout = {
        ...currentSectionLayout,
        tiles: nextTiles,
        visibleCount: Math.min(
          currentSectionLayout.visibleCount ?? nextTiles.length,
          Math.max(1, nextTiles.length),
        ),
        searchbaseAdditions: nextAdditions,
      };
      await saveWorkspaceLayout(
        insightsWorkspace,
        {
          [section]: nextSectionLayout,
        },
        workspaceLayout,
      );
      setWorkspaceLayout((current) => ({
        ...current,
        [section]: nextSectionLayout,
      }));
      showSectionTile(section, tileId);
      clearOverride(tileId);
    },
    [
      canManageWorkspaceConfig,
      clearOverride,
      currentSearchbaseOwnerApp,
      insightsWorkspace,
      showSectionTile,
      workspaceLayout,
    ],
  );

  const handleHideTileFromSection = useCallback(
    (cfg: MetricConfig) => {
      hideSectionTile(cfg.section, cfg.id);
      setStatuses((prev) => {
        if (!(cfg.id in prev)) return prev;
        const next = { ...prev };
        delete next[cfg.id];
        return next;
      });
    },
    [hideSectionTile],
  );

  const handleShowSearchInSection = useCallback(
    (section: SectionId, record: SearchbaseRecord) => {
      if (!record.id) return;
      const sectionMetrics = metricConfig.filter((m) => m.section === section);
      const target = sectionMetrics.find(
        (metric) =>
          searchbaseReferenceMatchesRecord(
            metric.searchbaseId,
            record,
            currentSearchbaseOwnerApp,
          ) && isSectionTileHidden(section, metric.id),
      );
      if (!target) return;

      const visibleSectionMetrics = renderMetricConfig.filter(
        (metric) => metric.section === section,
      );
      const currentVisibleCount = Math.min(
        sectionTileCounts[section],
        Math.min(sectionTileBounds.maxCount, visibleSectionMetrics.length),
      );
      const nextSectionMetrics = sectionMetrics.filter(
        (metric) =>
          metric.id === target.id || !isSectionTileHidden(section, metric.id),
      );
      const canonicalIds = getFactoryTileOrder(section, nextSectionMetrics);
      const orderedIds = getSectionTileOrder(section, canonicalIds);
      const nextOrder = orderedIds.filter((id) => id !== target.id);
      const insertAt =
        currentVisibleCount >= sectionTileBounds.maxCount
          ? Math.max(0, currentVisibleCount - 1)
          : Math.min(currentVisibleCount, nextOrder.length);
      nextOrder.splice(insertAt, 0, target.id);

      showSectionTile(section, target.id);
      setSectionTileOrder(section, nextOrder);
      changeSectionTileCount(
        section,
        Math.min(
          sectionTileBounds.maxCount,
          currentVisibleCount + 1,
          visibleSectionMetrics.length + 1,
        ),
      );
    },
    [
      getFactoryTileOrder,
      getSectionTileOrder,
      currentSearchbaseOwnerApp,
      isSectionTileHidden,
      metricConfig,
      renderMetricConfig,
      sectionTileBounds.maxCount,
      sectionTileCounts,
      changeSectionTileCount,
      setSectionTileOrder,
      showSectionTile,
    ],
  );

  // Bump this counter to force a fresh mount of <CustomerTopologyMap>.
  // localStorage `storage` events only fire across tabs, so wiping
  // the persisted topology in this tab won't reseed the map's
  // internal state on its own — a remount via `key={topologyResetKey}`
  // gets the hook to re-read storage (now empty) and fall back to
  // the canonical CUSTOMER_TOPOLOGY factory.
  const [topologyResetKey, setTopologyResetKey] = useState(0);
  const workspaceTopology = getWorkspaceTopology(insightsWorkspace.id);

  // Read the persisted topology so the dashboard header can show the
  // user's edited name / subtitle from the topology editor (instead of
  // hardcoded "Network Topology" / "Site connectivity and path
  // health"). The same hook the map uses; same localStorage key, so
  // edits land here without any manual sync.
  const {
    topology: persistedTopology,
    sectionTitles,
    saveSectionTitles,
  } = usePersistedTopology(workspaceTopology);
  const topologyHeaderName =
    persistedTopology.name?.trim() || "Network Topology";
  const topologyHeaderSubtitle =
    persistedTopology.subtitle?.trim() || "Site connectivity and path health";
  const effectiveSectionMeta = useMemo(() => {
    const out: Partial<
      Record<
        SectionId,
        {
          title: string;
          linkText: string;
          href?: string;
          icon: React.ReactNode;
        }
      >
    > = {};
    for (const section of insightsWorkspace.sections) {
      const Icon = SECTION_ICON_COMPONENTS[section.icon];
      const fallbackIcon = <Icon className="h-5 w-5" strokeWidth={2.2} />;
      const iconMaskStyle: React.CSSProperties | undefined = section.iconSrc
        ? {
            WebkitMaskImage: `url("${section.iconSrc}")`,
            maskImage: `url("${section.iconSrc}")`,
            WebkitMaskPosition: "center",
            maskPosition: "center",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskSize: "contain",
            maskSize: "contain",
          }
        : undefined;
      out[section.id] = {
        title: sectionTitles[section.id] || section.title,
        linkText: section.linkText,
        href: section.href,
        icon: section.iconSrc ? (
          <span
            aria-hidden="true"
            className="relative inline-flex h-full w-full"
          >
            {SECTION_ICON_MASK_OFFSETS.map(([x, y]) => (
              <span
                key={`${x}:${y}`}
                className="absolute inset-0 sui-bg-accent"
                style={{
                  ...iconMaskStyle,
                  transform: `translate(${x}px, ${y}px)`,
                }}
              />
            ))}
          </span>
        ) : (
          fallbackIcon
        ),
      };
    }
    return out as Record<
      SectionId,
      {
        title: string;
        linkText: string;
        href?: string;
        icon: React.ReactNode;
      }
    >;
  }, [insightsWorkspace, sectionTitles]);

  const addTilePickerState = useMemo(() => {
    const pickerSection = addTileSection ?? lastAddTileSection;
    if (!pickerSection) return null;
    const sectionMetrics = metricConfig.filter(
      (m) => m.section === pickerSection,
    );
    const visibleSectionMetrics = renderMetricConfig.filter(
      (m) => m.section === pickerSection,
    );
    const canonicalIds = getFactoryTileOrder(
      pickerSection,
      visibleSectionMetrics,
    );
    const orderedIds = getSectionTileOrder(pickerSection, canonicalIds);
    const configuredMetricIds = new Set(
      orderedIds.slice(
        0,
        Math.min(sectionTileBounds.maxCount, orderedIds.length),
      ),
    );
    const currentSearchbaseIds = new Set(
      visibleSectionMetrics
        .filter((metric) => configuredMetricIds.has(metric.id))
        .map((metric) => metric.searchbaseId)
        .filter((id): id is string => Boolean(id)),
    );
    const hiddenSearchbaseIds = new Set(
      sectionMetrics
        .filter((metric) => isSectionTileHidden(pickerSection, metric.id))
        .map((metric) => metric.searchbaseId)
        .filter((id): id is string => Boolean(id)),
    );
    const currentVisibleCount = Math.min(
      sectionTileCounts[pickerSection],
      Math.min(sectionTileBounds.maxCount, visibleSectionMetrics.length),
    );
    return {
      section: pickerSection,
      sectionTitle: effectiveSectionMeta[pickerSection]?.title ?? pickerSection,
      currentSearchbaseIds,
      hiddenSearchbaseIds,
      locallyAddedSearchbaseIds: new Set(
        getSectionTileAdditions(pickerSection),
      ),
      workspaceAddedSearchbaseIds: new Set(
        workspaceLayout[pickerSection]?.searchbaseAdditions ?? [],
      ),
      currentVisibleCount,
      currentConfiguredCount: configuredMetricIds.size,
    };
  }, [
    addTileSection,
    effectiveSectionMeta,
    getSectionTileAdditions,
    getFactoryTileOrder,
    getSectionTileOrder,
    isSectionTileHidden,
    lastAddTileSection,
    metricConfig,
    renderMetricConfig,
    sectionTileBounds.maxCount,
    sectionTileCounts,
    workspaceLayout,
  ]);

  // Saved-search names already bound across the dashboard, so the
  // picker can flag duplicates with an "in use" badge. Search
  // binding is admin-controlled now (searchbase.conf), so `cfg`
  // already reflects the effective binding — no override to layer.
  const usedSavedSearches = useMemo(() => {
    const used = new Set<string>();
    for (const m of metricConfig) {
      if (m.savedSearch) used.add(m.savedSearch);
    }
    for (const k of mapFooterKpiConfig) {
      if (k.savedSearch) used.add(k.savedSearch);
    }
    return used;
  }, [mapFooterKpiConfig, metricConfig]);

  const openPicker = useCallback(
    (
      tileId: string,
      defaultLabel: string,
      current?: {
        savedSearch?: string;
        valueField?: string;
        /**
         * Static (code-defined) threshold tuple for this tile.
         * The picker uses this to pre-fill the THRESHOLDS form
         * with the tile's factory baseline, so the user always
         * sees what they're modifying away from. Also drives
         * the per-field "Reset to default" affordance — fields
         * matching `defaultThresholds` are omitted from the
         * persisted override so the storage payload only
         * carries genuine deltas. Undefined for tiles that
         * shipped without numeric thresholds (e.g. KPI cards
         * with string headlines); the form still renders so
         * the user can establish thresholds if they swap the
         * tile to a numeric search.
         */
        defaultThresholds?: MetricThresholds;
        /** Static unit ('%', 'ms', etc.) for threshold preview formatting. */
        unit?: string;
        /**
         * Section the tile lives in (Build 1203). Threaded
         * through to the picker so the Display block can
         * offer "Apply to all tiles in <section>" as an
         * ergonomic shortcut for operators who want every
         * KPI in a section to read the same way (e.g. hide
         * delta pills across all IT Health tiles for a
         * cleaner status board view). Optional — when
         * omitted (e.g. MetricItem tiles outside the KPI
         * grid) the picker silently skips the link, no
         * other behaviour changes.
         */
        section?: SectionId;
        allowPersonalDisplayControls?: boolean;
      },
      returnFocus?: HTMLElement | null,
    ) => {
      // Search binding, value field, label, and thresholds are
      // admin-controlled (searchbase.conf) now — `current` IS
      // the effective value, no per-user override to layer on
      // top. Only chart style / display flags still come from
      // the viewer's own localStorage override.
      const ov: MetricOverride | undefined = overrides[tileId];
      pickerReturnFocusRef.current = returnFocus ?? null;
      setPickerContext({
        tileId,
        defaultLabel,
        currentSavedSearch: current?.savedSearch,
        currentValueField: current?.valueField,
        currentLabel: defaultLabel,
        defaultThresholds: current?.defaultThresholds,
        currentThresholds: current?.defaultThresholds,
        thresholdUnit: current?.unit,
        usedSavedSearches,
        currentVizOverride: ov?.vizOverride,
        currentHidePeak: ov?.hidePeak,
        currentHideDelta: ov?.hideDelta,
        currentHideOverlay: ov?.hideOverlay,
        allowPersonalDisplayControls: current?.allowPersonalDisplayControls,
        sectionId: current?.section,
        sectionLabel: current?.section
          ? effectiveSectionMeta[current.section]?.title
          : undefined,
      });
    },
    [effectiveSectionMeta, overrides, usedSavedSearches],
  );

  const closePicker = useCallback(() => setPickerContext(null), []);

  const handlePickerApply = useCallback(
    (tileId: string, override: MetricOverride) => {
      setOverride(tileId, override);
      setPickerContext(null);
    },
    [setOverride],
  );

  // ------------------------------ Admin-only tile config (Thresholds / Data Mapping / Drilldown) ------------------------------
  //
  // `canManageFactoryConfig` is a UI-side courtesy check only — the
  // real enforcement is `metadata/default.meta` restricting
  // searchbase.conf writes to `admin_all_objects`. See
  // `useCanManageFactoryTileConfig` and `searchbaseTileConfigService`.
  const [workspaceManagerOpen, setWorkspaceManagerOpen] = useState(false);
  const [factoryTileConfigStatus, setFactoryTileConfigStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [factoryResetStatus, setFactoryResetStatus] = useState<
    "idle" | "resetting" | "error"
  >("idle");

  const handleSaveFactoryTileConfig = useCallback(
    async (patch: FactoryTileConfigApplyPatch) => {
      const currentSavedSearch = pickerContext?.currentSavedSearch;
      const fromStanzaId = currentSavedSearch
        ? searchbaseByName?.get(currentSavedSearch)?.id
        : undefined;
      if (!fromStanzaId) {
        console.error(
          "[overview] cannot save factory tile config: unresolved source stanza",
          patch.tileId,
        );
        return;
      }
      const toStanzaId = patch.newSearchName
        ? searchbaseByName?.get(patch.newSearchName)?.id
        : undefined;
      if (patch.newSearchName && !toStanzaId) {
        console.error(
          "[overview] cannot save factory tile config: unresolved target stanza",
          patch.newSearchName,
        );
        return;
      }
      const mapFooter = mapFooterKpiConfig.find(
        (candidate) => candidate.id === patch.tileId,
      );

      setFactoryTileConfigStatus("saving");
      try {
        await saveFactoryTileConfig({
          tileId: patch.tileId,
          workspaceId: insightsWorkspace.sourceWorkspace,
          section:
            pickerContext?.sectionId ??
            insightsWorkspace.defaultVisibleSections[0] ??
            "custom",
          target: mapFooter
            ? { kind: "mapFooter", slot: mapFooter.slot }
            : { kind: "overview" },
          fromStanzaId,
          thresholds: patch.thresholds,
          dataMapping: patch.dataMapping,
          searchRebind: toStanzaId ? { toStanzaId } : undefined,
          drilldownSearchNames: patch.drilldownSearchNames,
        });
        setSearchbaseRefreshToken((n) => n + 1);
        setFactoryTileConfigStatus("saved");
        setPickerContext(null);
        if (typeof window !== "undefined") {
          window.setTimeout(() => setFactoryTileConfigStatus("idle"), 2400);
        }
      } catch (error) {
        console.error("[overview] failed to save factory tile config", error);
        setFactoryTileConfigStatus("error");
        if (typeof window !== "undefined") {
          window.alert(
            error instanceof Error
              ? error.message
              : "Could not save this tile setting.",
          );
          window.setTimeout(() => setFactoryTileConfigStatus("idle"), 4000);
        }
      }
    },
    [insightsWorkspace, mapFooterKpiConfig, pickerContext, searchbaseByName],
  );

  // Drilldown edits now go through `handleSaveFactoryTileConfig`
  // (admin-only, written into searchbase.conf). The
  // `usePersistedSearchbaseDrilldowns` hook stays only for its
  // `resetAll` in `handleResetAllCustomizations`, so any leftover
  // local override from before this migration can still be cleared.

  /**
   * Section-level "Apply these Display settings to all tiles in
   * this section" handler (Build 1203, from Atef's "global vs
   * per-KPI settings" framing). Fans the three display flags
   * (`hidePeak`, `hideDelta`, `hideOverlay`) out to every
   * MetricItem AND KpiCard in the named section, including the
   * current tile, so the picker can close immediately afterwards
   * without a separate Apply click.
   *
   * Merge semantics:
   *   • Tiles with an existing override → keep every existing
   *     field (savedSearch, valueField, thresholds, chart style,
   *     label, etc.) and just overlay the three display flags.
   *     `false` writes are normalised to "absent" via the
   *     sanitiser, so a "show everything" patch wipes the flags
   *     rather than persisting `false`.
   *   • Tiles without an existing override → write a minimal
   *     override carrying the tile's own `savedSearch` (the
   *     required field on `MetricOverride`) plus the requested
   *     display flags. The tile picks up a "(custom)" dot in
   *     the UI, which is honest: it IS customised now.
   *
   * Why this lives in the page (not the picker): the picker
   * doesn't know the section roster, and we don't want to hand
   * it the whole searchbase-backed tile catalogue. The
   * page owns the catalogue; the picker hands us the section id
   * and the patch and we do the fan-out.
   *
   * Scope contract: deliberately limited to display flags so
   * the link's behaviour stays predictable. Chart style and
   * thresholds are still per-tile customisations — that's where
   * tile-by-tile semantics matter and a section-wide apply would
   * be more confusing than helpful (a status board with five
   * tiles forced into the same chart style usually isn't what
   * the operator wanted).
   */
  const handleApplyDisplayToSection = useCallback(
    (
      sectionId: string,
      patch: { hidePeak: boolean; hideDelta: boolean; hideOverlay: boolean },
    ) => {
      // Resolve siblings from the metric catalogue only. Display
      // flags are the only thing left in the per-user override,
      // so no need to carry a search binding through anymore.
      const sectionMetrics = renderMetricConfig.filter(
        (m) => m.section === sectionId,
      );
      for (const m of sectionMetrics) {
        const existing = overrides[m.id];
        const next: MetricOverride = {
          ...existing,
          // Pass `undefined` for false flags so the sanitiser
          // strips them from the persisted payload — gives us
          // a "show everything" reset path through the same
          // code that handles "hide everything".
          hidePeak: patch.hidePeak ? true : undefined,
          hideDelta: patch.hideDelta ? true : undefined,
          hideOverlay: patch.hideOverlay ? true : undefined,
        };
        setOverride(m.id, next);
      }
      setPickerContext(null);
    },
    [overrides, renderMetricConfig, setOverride],
  );

  // "Factory reset" — wipes every persisted dashboard customisation
  // in one shot. The picker shows a `window.confirm()` prompt before
  // calling this, so misclicks are caught at the UI layer; we only
  // get here if the user has explicitly agreed.
  //
  // What gets reset (and the localStorage keys cleared):
  //   • metricOverrides.v1            — per-tile picker bindings
  //   • searchbaseDrilldowns.v1       — picker-wired drilldown bindings
  //   • sectionLayout.v1              — visible section roster
  //   • sectionTileCounts.v1          — visible tile count per section
  //                                      (restored to the active shared
  //                                      factory default)
  //   • sectionTileAdditions.v1       — per-user searchbase tiles added
  //                                      into profile sections
  //   • sectionHiddenTiles.v1         — per-user hidden factory tiles
  //   • sectionHeights.v1             — vertical room per section
  //   • sectionPresentation.v1        — collapsed state per section
  //   • sectionTileOrder.v1           — drag-to-reorder preference
  //   • customerTopology.v4           — retired per-browser map payload
  //   • scd_overview_split_pct        — tiles ↔ map splitter position
  //   • scd_overview_map_pos          — leftover map-position localStorage
  //   • scd_overview_map_visible      — leftover map-visibility localStorage
  //   • scd_overview_map_height       — map panel height (workspace / compact)
  //   • priorityDrilldown.v1          — pinned app-local drill-down target
  //   • insights_workspace_preferences.conf — private Signal Rail display
  //                                      prefs; leftover item patches are
  //                                      ignored after hydration
  //
  // What is intentionally NOT reset:
  //   • header branding (title / subtitle / logo) — identity, not
  //     dashboard layout or tile state
  //   • theme (light / dark) — UI preference, not layout
  //   • shared Overview factory defaults — app-wide state, not a
  //     per-user customisation
  //   • shared searchbase tile configuration — app-wide state, not a
  //     per-user customisation
  //   • shared customer_topology.conf — site/link and section-title
  //     edits are global app state, not per-user layout preference
  //
  // After reset, we close the picker and bump `topologyResetKey` to
  // clear any retired in-browser topology payload from old builds.
  const handleResetAllCustomizations = useCallback(() => {
    resetAllOverrides();
    resetAllSearchbaseDrilldowns();
    resetAllSectionLayout();
    resetAllSectionTileCounts();
    resetAllSectionTileAdditions();
    resetAllSectionHiddenTiles();
    resetAllSectionHeights();
    resetAllSectionPresentation();
    resetAllSectionTileOrder();
    setSectionTilePages({});
    setShowAllTileSections({});
    resetSignalTickerConfig();
    clearCustomerTopologyStorage();
    setTopologyResetKey((n) => n + 1);
    setLeftPct(SPLIT_DEFAULT);
    setMapPosition(insightsWorkspace.mapPosition);
    setMapVisible(insightsWorkspace.mapVisible);
    setMapHeightMode(MAP_HEIGHT_DEFAULT);
    setSelectedPriorityDrilldownView(DEFAULT_PRIORITY_DRILLDOWN_VIEW);
    setFocusedSection(null);
    clearPriorityDrilldownView();
    setAddTileSection(null);
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.removeItem(SPLIT_KEY);
        window.localStorage.removeItem(MAP_POS_KEY);
        window.localStorage.removeItem(MAP_VISIBILITY_KEY);
        window.localStorage.removeItem(MAP_HEIGHT_KEY);
      } catch {
        // Storage unavailable; the in-memory state resets
        // above are authoritative for this session anyway.
      }
    }
    setPickerContext(null);
  }, [
    resetAllOverrides,
    resetAllSearchbaseDrilldowns,
    resetAllSectionLayout,
    resetAllSectionTileCounts,
    resetAllSectionTileAdditions,
    resetAllSectionHiddenTiles,
    resetAllSectionHeights,
    resetAllSectionPresentation,
    resetAllSectionTileOrder,
    resetSignalTickerConfig,
    SPLIT_KEY,
    SPLIT_DEFAULT,
    setLeftPct,
    insightsWorkspace,
    MAP_POS_KEY,
    setMapPosition,
    MAP_VISIBILITY_KEY,
    setMapVisible,
    MAP_HEIGHT_KEY,
    MAP_HEIGHT_DEFAULT,
    setMapHeightMode,
  ]);

  const handleResetWorkspaceToFactory = useCallback(async () => {
    if (!insightsWorkspace.isBuiltIn || factoryResetStatus === "resetting") {
      return;
    }
    const confirmed =
      typeof window === "undefined" ||
      window.confirm(
        `Reset ${insightsWorkspace.label} to packaged factory defaults?\n\n` +
          "This permanently removes app-local insights_workspaces.conf and " +
          "searchbase.conf overrides for this workspace, plus your personal " +
          "tile, section, Signal Rail, and map preferences. Other workspaces " +
          "and indexed data are not changed. This cannot be undone.",
      );
    if (!confirmed) return;

    setFactoryResetStatus("resetting");
    try {
      const packagedWorkspace = PACKAGED_WORKSPACE_FALLBACKS.find(
        (candidate) => candidate.id === insightsWorkspace.id,
      );
      if (!packagedWorkspace?.isBuiltIn) {
        throw new Error(
          "Only built-in workspaces can be reset to packaged defaults.",
        );
      }
      await resetInsightsWorkspaceTileConfig(
        baseMetricConfig.map((metric) => metric.searchbaseId),
        packagedWorkspace.sourceWorkspace,
      );
      await resetBuiltInInsightsWorkspace(insightsWorkspace);
      handleResetAllCustomizations();
      window.location.reload();
    } catch (error) {
      console.error(
        "[insights] failed to reset workspace to factory defaults",
        error,
      );
      setFactoryResetStatus("error");
      if (typeof window !== "undefined") {
        window.alert(
          error instanceof Error
            ? error.message
            : "Could not reset this workspace to factory defaults.",
        );
      }
    }
  }, [
    baseMetricConfig,
    factoryResetStatus,
    handleResetAllCustomizations,
    insightsWorkspace,
  ]);

  const handlePublishWorkspaceLayout = useCallback(async () => {
    const next: WorkspaceLayoutConfig = {};
    for (const section of availableSections) {
      // Local additions stay personal; shared Searchbase additions are
      // deliberately carried with this workspace's layout.
      const sectionMetrics = baseMetricConfig.filter(
        (m) => m.section === section,
      );
      if (sectionMetrics.length === 0) continue;
      const factoryOrder = getFactoryTileOrder(section, sectionMetrics);
      const effectiveOrder = getSectionTileOrder(section, factoryOrder);
      const visibleCount = Math.min(
        sectionTileCounts[section],
        Math.min(sectionTileBounds.maxCount, sectionMetrics.length),
      );
      next[section] = {
        tiles: effectiveOrder,
        visibleCount,
        searchbaseAdditions: Array.from(
          new Set([
            ...(workspaceLayout[section]?.searchbaseAdditions ?? []),
            ...(sectionTileAdditions[section] ?? []),
          ]),
        ),
      };
    }

    setWorkspaceLayoutStatus("saving");
    try {
      await saveWorkspaceLayout(insightsWorkspace, next, workspaceLayout);
      setWorkspaceLayout(next);
      setWorkspaceLayoutStatus("saved");
      if (typeof window !== "undefined") {
        window.setTimeout(() => setWorkspaceLayoutStatus("idle"), 2400);
      }
    } catch (error) {
      console.error("[insights] failed to publish workspace layout", error);
      setWorkspaceLayoutStatus("error");
      if (typeof window !== "undefined") {
        window.alert(
          error instanceof Error
            ? error.message
            : "Could not publish this workspace layout.",
        );
        window.setTimeout(() => setWorkspaceLayoutStatus("idle"), 4000);
      }
    }
  }, [
    availableSections,
    baseMetricConfig,
    getFactoryTileOrder,
    getSectionTileOrder,
    insightsWorkspace,
    sectionTileAdditions,
    sectionTileBounds.maxCount,
    sectionTileCounts,
    workspaceLayout,
  ]);

  // ------------------------------ Map footer ------------------------------
  // Same dispatch rules as the main metric grid: searchbase.conf
  // entries resolve to literal SPL so the footer value, picker preview,
  // and Open in Search action all point at the same query.
  // Search binding / value field / label for the map footer cards
  // are admin-controlled (searchbase.conf `viz_options.mapFooter`)
  // now, same as the main tile grid — `base` is already the
  // effective value, no per-user override to layer on top.
  const buildEffectiveMapFooterKpiCfg = (
    base: MapFooterKpiConfig,
  ): MapFooterKpiConfig => {
    if (searchbaseByName === null || searchbaseById === null) {
      return { ...base, spl: undefined, savedSearch: undefined };
    }

    const sbBase = resolveSearchbaseRecordForConfig(
      base,
      searchbaseById,
      searchbaseByName,
    );
    if (sbBase?.search) {
      return {
        ...base,
        spl: sbBase.search,
        savedSearch: undefined,
        dispatchContext: sbBase.dispatchContext,
      };
    }
    return { ...base, savedSearch: undefined, spl: undefined };
  };

  const mapPrimaryBaseCfg = mapFooterKpiConfig[0];
  const mapSecondaryBaseCfg = mapFooterKpiConfig[1];
  const effectiveMapPrimaryCfg = useMemo<MapFooterKpiConfig>(
    () =>
      mapPrimaryBaseCfg
        ? buildEffectiveMapFooterKpiCfg(mapPrimaryBaseCfg)
        : DISABLED_MAP_FOOTER_KPI_CONFIG,
    [mapPrimaryBaseCfg, searchbaseById, searchbaseByName],
  );
  const effectiveMapSecondaryCfg = useMemo<MapFooterKpiConfig>(
    () =>
      mapSecondaryBaseCfg
        ? buildEffectiveMapFooterKpiCfg(mapSecondaryBaseCfg)
        : DISABLED_MAP_FOOTER_KPI_CONFIG,
    [mapSecondaryBaseCfg, searchbaseById, searchbaseByName],
  );
  const mapPrimary = useKpi(effectiveMapPrimaryCfg, timeRange, refreshToken);
  const mapSecondary = useKpi(
    effectiveMapSecondaryCfg,
    timeRange,
    refreshToken,
  );

  // ------------------------------ Keyboard shortcuts ------------------------------
  // Drilldowns open in a new tab so the executive can keep the
  // overview as a persistent "command center" view alongside the
  // detail dashboard.
  const openDrilldown = useCallback((view: string) => {
    if (typeof window === "undefined") return;
    window.open(view, "_blank", "noopener,noreferrer");
  }, []);
  const cycleTimeRange = useCallback(() => {
    setTimeRange((current) => {
      const idx = TIME_RANGE_OPTIONS.findIndex(
        (o) => o.label === current.label,
      );
      return TIME_RANGE_OPTIONS[(idx + 1) % TIME_RANGE_OPTIONS.length];
    });
  }, []);
  const focusGlobalSearch = useCallback(() => {
    // Until a global search bar is wired, focus the dashboard-actions menu,
    // which now owns the time-range controls.
    const el = document.querySelector<HTMLButtonElement>(
      "button[data-shortcut-search]",
    );
    el?.focus();
  }, []);
  const openSignalTickerEditor = useCallback(() => {
    setSignalTickerEditorOpen(true);
  }, []);
  const closeHelp = useCallback(() => {
    setHelpOpen(false);
    window.requestAnimationFrame(() => {
      if (helpReturnFocusRef.current?.isConnected) {
        helpReturnFocusRef.current.focus({ preventScroll: true });
      }
      helpReturnFocusRef.current = null;
    });
  }, []);
  const toggleHelp = useCallback(() => {
    if (helpOpen) {
      closeHelp();
      return;
    }
    helpReturnFocusRef.current = document.activeElement as HTMLElement | null;
    setHelpOpen(true);
  }, [closeHelp, helpOpen]);

  const SHORTCUTS = useMemo<
    { keys: string; description: string; handler: () => void }[]
  >(() => {
    const sectionShortcuts = visibleSections
      .slice(0, 9)
      .map((section, idx) => {
        const meta = effectiveSectionMeta[section];
        const href = meta?.href;
        if (!meta || !href) return null;
        return {
          keys: `g ${idx + 1}`,
          description: `${meta.linkText} (new tab)`,
          handler: () => openDrilldown(href),
        };
      })
      .filter(
        (
          shortcut,
        ): shortcut is {
          keys: string;
          description: string;
          handler: () => void;
        } => Boolean(shortcut),
      );
    return [
      ...sectionShortcuts,
      {
        keys: "g r",
        description: "Configure Signal Rail",
        handler: openSignalTickerEditor,
      },
      { keys: "t", description: "Cycle time range", handler: cycleTimeRange },
      { keys: "r", description: "Refresh all data now", handler: refreshNow },
      {
        keys: "/",
        description: "Focus the time-range picker",
        handler: focusGlobalSearch,
      },
      {
        keys: "?",
        description: "Toggle this help overlay",
        handler: toggleHelp,
      },
    ];
  }, [
    cycleTimeRange,
    effectiveSectionMeta,
    focusGlobalSearch,
    openDrilldown,
    openSignalTickerEditor,
    refreshNow,
    toggleHelp,
    visibleSections,
  ]);
  const helpShortcutRows = useMemo(
    () =>
      SHORTCUTS.map((s) => ({
        keys: s.keys,
        description: s.description,
      })),
    [SHORTCUTS],
  );
  useKeyboardShortcuts(SHORTCUTS, true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && helpOpen) closeHelp();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeHelp, helpOpen]);

  // ------------------------------ Render ------------------------------
  return (
    <div
      ref={exportRef}
      style={dashboardShellStyle}
      className={cn(
        "scd-overview-page scd-c3-surface relative isolate flex w-full min-w-0 max-w-full flex-col overflow-hidden font-sans",
        compactDensity && "scd-overview-compact",
        "sui-bg-page sui-color-active",
        "sui-bg-page sui-color-active",
        "scd-one-cisco-spotlight-canvas sui-bg-page sui-color-default",
      )}
      data-color-scheme={colorScheme}
    >
      <SpotLight
        aria-hidden="true"
        variant="page-top"
        intensity="low"
        scale={0.5}
      />
      {/* Header */}
      <header className="scd-c3-toolbar h-14 flex-shrink-0  sui-bg-transparent border-0 flex items-center justify-between shadow-none backdrop-filter-none">
        {/*
         * The branding cluster (logo + title/subtitle + edit
         * pencil) is the hover-trigger group. The pencil sits
         * hidden by default (`opacity-0`) and reveals on hover
         * anywhere in the cluster, OR on keyboard focus of the
         * pencil itself via `focus-visible`. `focus-visible`
         * (not `focus`) keeps the pencil hidden when the user
         * clicks elsewhere and the button is mouse-focused —
         * we only want the hover/keyboard reveal so the
         * default header stays visually clean for executives
         * who don't need to rebrand. The named-group form
         * (`group/branding`) scopes the hover trigger to the
         * cluster so any future ancestor `group` class doesn't
         * accidentally fire the same reveal.
         */}
        <div
          className={cn(
            "flex min-w-0 flex-1 items-center pr-3 group/branding",
            effectiveLogoSrc ? "gap-3" : "gap-0",
          )}
        >
          {effectiveLogoSrc ? (
            <div className="w-9 h-9 sui-bg-notification-info rounded-lg flex items-center justify-center sui-color-active overflow-hidden p-1 flex-shrink-0">
              <img
                src={effectiveLogoSrc}
                alt="Dashboard logo"
                className="w-full h-full object-contain"
                onError={() => {
                  // If a future non-data default logo fails to
                  // load, recover to the neutral built-in mark
                  // instead of leaving a broken image in the
                  // executive header. User-uploaded data URIs
                  // are self-contained and managed by the
                  // branding editor.
                  if (logoSrc !== DEFAULT_LOGO_DATA_URI) {
                    setLogoSrc(DEFAULT_LOGO_DATA_URI);
                  }
                }}
              />
            </div>
          ) : null}
          <div className="min-w-0">
            <div
              className="flex min-w-0 items-center"
              style={{ columnGap: spacingSmall }}
            >
              <Heading
                level={1}
                variant="title1"
                data-sui-heading-variant="title1"
                className="truncate"
              >
                {effectiveTitle}
              </Heading>
              <Dropdown
                focusToggleReasons={["escapeKey", "tabKey", "toggleClick"]}
                toggle={
                  <Button
                    appearance="subtle"
                    elementRef={workspaceToggleRef}
                    hideLabel
                    icon={<ChevronDown aria-hidden="true" />}
                    label={`Switch workspace. Current: ${insightsWorkspace.label}`}
                  />
                }
              >
                <Menu style={{ width: WORKSPACE_MENU_WIDTH_PX }}>
                  {workspaces.map((workspace) => (
                    <Menu.Item
                      key={workspace.id}
                      onClick={() =>
                        rememberLastWorkspace(workspace.id, workspaces)
                      }
                      to={`${splunkViewAppUrl("workspace_insights")}?workspace=${encodeURIComponent(
                        workspace.id,
                      )}`}
                      selectable
                      selected={workspace.id === insightsWorkspace.id}
                    >
                      {workspace.label}
                    </Menu.Item>
                  ))}
                  {canManageWorkspaceConfig && (
                    <>
                      <Menu.Divider />
                      <Menu.Item
                        onClick={() => setWorkspaceManagerOpen(true)}
                        startAdornment={<Edit3 aria-hidden="true" />}
                      >
                        Edit workspaces
                      </Menu.Item>
                    </>
                  )}
                </Menu>
              </Dropdown>
            </div>
            <p className="mt-1 truncate text-xs font-medium leading-none  sui-color-default">
              {effectiveSubtitle}
            </p>
          </div>
          {canManageWorkspaceConfig ? (
          <button
            type="button"
            onClick={() => setBrandingEditorOpen(true)}
            title="Edit branding (title, subtitle, logo)"
            aria-label="Edit branding (title, subtitle, logo)"
            className="flex-shrink-0 p-1 rounded sui-color-default  sui-hover-color-info  sui-hover-bg-overlay opacity-0 group-hover/branding:opacity-100 focus-visible:opacity-100 transition"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          ) : null}
        </div>

        <div
          className="flex flex-shrink-0 items-center"
          style={{ columnGap: spacingXSmall }}
        >
          <div className="scd-header-map-layout">
            <MapLayoutRadioBar
              value={activeMapPosition}
              onChange={updateMapLayout}
            />
          </div>
          <TimeRangeControl range={timeRange} onChange={setTimeRange} />
          <Select
            appearance="subtle"
            className="scd-header-refresh-rate"
            inline
            onChange={(_event, { value }) =>
              setAutoRefreshSeconds(Number(value))
            }
            prefixLabel="Refresh rate"
            style={{ width: HEADER_REFRESH_RATE_WIDTH_PX }}
            value={autoRefreshSeconds}
          >
            {AUTO_REFRESH_OPTIONS.map((option) => (
              <Select.Option
                key={option.seconds}
                label={option.label}
                value={option.seconds}
              />
            ))}
          </Select>
          <Button
            appearance="subtle"
            hideLabel
            icon={
              <RefreshCw
                className={autoRefreshSeconds > 0 ? "animate-pulse" : undefined}
              />
            }
            label={`Refresh dashboard data now. Last refreshed ${lastRefreshed.toLocaleTimeString(
              [],
              { hour: "2-digit", minute: "2-digit" },
            )}`}
            onClick={refreshNow}
          />
          <Button
            appearance="subtle"
            hideLabel
            icon={
              presentationMode ? (
                <Minimize2 aria-hidden="true" />
              ) : (
                <Maximize2 aria-hidden="true" />
              )
            }
            label={
              presentationMode
                ? "Exit full screen"
                : "Enter full screen presentation mode"
            }
            onClick={togglePresentationMode}
          />
          <Button
            appearance="subtle"
            className="scd-header-app-version"
            label={appVersionLabel}
            openInNewContext
            title={`App details and upgrades — ${appVersionLabel} (opens in new window)`}
            aria-label={`App details and upgrades, ${appVersionLabel} (opens in new window)`}
            to={appCatalogUrl}
          />
          <Dropdown
            defaultPlacement="below"
            focusToggleReasons={["escapeKey", "tabKey", "toggleClick"]}
            open={headerActionsOpen}
            onRequestClose={() => setHeaderActionsOpen(false)}
            onRequestOpen={() => setHeaderActionsOpen(true)}
            toggle={
              <Button
                appearance="subtle"
                data-shortcut-search
                elementRef={headerActionsToggleRef}
                hideLabel
                icon={<DotsThreeVertical aria-hidden="true" />}
                label="Dashboard actions"
              />
            }
          >
            <Menu>
              <Menu.Heading title>
                Dashboard controls · {headerHealthSummary}
              </Menu.Heading>
              <Menu.Item
                disabled={exporting}
                onClick={() => {
                  closeHeaderActions();
                  exportAs("png");
                }}
                startAdornment={<Download aria-hidden="true" />}
              >
                Export as PNG
              </Menu.Item>
              <Menu.Item
                disabled={exporting}
                onClick={() => {
                  closeHeaderActions();
                  exportAs("pdf");
                }}
                startAdornment={<Download aria-hidden="true" />}
              >
                Export as PDF
              </Menu.Item>
              <Menu.Heading>Map layout</Menu.Heading>
              {MAP_LAYOUT_OPTIONS.map((option) => (
                <Menu.Item
                  key={option.value}
                  onClick={() => {
                    updateMapLayout(option.value);
                    closeHeaderActions();
                  }}
                  selectable
                  selected={activeMapPosition === option.value}
                  startAdornment={option.startAdornment}
                >
                  {option.ariaLabel}
                </Menu.Item>
              ))}
              {mapVisible && (
                <>
                  <Menu.Heading>Map height</Menu.Heading>
                  <Menu.Item
                    onClick={() => {
                      setMapHeightMode("match-workspace");
                      closeHeaderActions();
                    }}
                    selectable
                    selected={mapHeightMode === "match-workspace"}
                    startAdornment={<Maximize2 aria-hidden="true" />}
                  >
                    Match workspace
                  </Menu.Item>
                  <Menu.Item
                    onClick={() => {
                      setMapHeightMode("compact");
                      closeHeaderActions();
                    }}
                    selectable
                    selected={mapHeightMode === "compact"}
                    startAdornment={<Minimize2 aria-hidden="true" />}
                  >
                    Compact
                  </Menu.Item>
                </>
              )}
              <Menu.Heading>Refresh rate</Menu.Heading>
              {AUTO_REFRESH_OPTIONS.map((option) => (
                <Menu.Item
                  key={option.seconds}
                  onClick={() => {
                    setAutoRefreshSeconds(option.seconds);
                    closeHeaderActions();
                  }}
                  selectable
                  selected={autoRefreshSeconds === option.seconds}
                >
                  {option.label}
                </Menu.Item>
              ))}
              <Menu.Heading>Search loading</Menu.Heading>
              {[1, 2, 3, 4].map((concurrency) => (
                <Menu.Item
                  key={concurrency}
                  description={
                    concurrency === 1
                      ? "Lowest stack pressure"
                      : concurrency === 4
                        ? "Fastest on high-capacity stacks"
                        : undefined
                  }
                  onClick={() => {
                    setSearchConcurrency(concurrency);
                    closeHeaderActions();
                  }}
                  selectable
                  selected={searchConcurrency === concurrency}
                >
                  {concurrency} simultaneous search
                  {concurrency === 1 ? "" : "es"}
                </Menu.Item>
              ))}
              {canChooseColorScheme && (
                <AppearanceMenuItems onSelect={() => closeHeaderActions()} />
              )}
              {overrideCount > 0 && (
                <Menu.Item
                  description={`${overrideCount} customised`}
                  onClick={() => {
                    closeHeaderActions();
                    if (
                      typeof window === "undefined" ||
                      window.confirm(
                        `Reset ${overrideCount} customised tile${
                          overrideCount === 1 ? "" : "s"
                        } to their default search bindings?`,
                      )
                    ) {
                      resetAllOverrides();
                    }
                  }}
                  startAdornment={<RotateCcw aria-hidden="true" />}
                >
                  Reset customised tiles
                </Menu.Item>
              )}
              {canManageWorkspaceConfig &&
                canManageFactoryConfig &&
                insightsWorkspace.isBuiltIn && (
                  <Menu.Item
                    description="Removes local config overrides and personal layout settings"
                    disabled={factoryResetStatus === "resetting"}
                    onClick={() => {
                      closeHeaderActions();
                      void handleResetWorkspaceToFactory();
                    }}
                    startAdornment={<RotateCcw aria-hidden="true" />}
                  >
                    {factoryResetStatus === "resetting"
                      ? "Resetting workspace"
                      : "Reset workspace to factory defaults"}
                  </Menu.Item>
                )}
              <Menu.Item
                onClick={() => {
                  helpReturnFocusRef.current = headerActionsToggleRef.current;
                  closeHeaderActions();
                  setHelpOpen(true);
                }}
                startAdornment={<Keyboard aria-hidden="true" />}
              >
                Keyboard shortcuts
              </Menu.Item>
            </Menu>
          </Dropdown>
        </div>
      </header>

      <SignalTickerRail
        config={signalTickerConfig}
        catalogueByName={
          signalTickerPersistenceStatus === "loading"
            ? null
            : searchbaseByName
        }
        metricDefaultsBySearchName={signalTickerMetricDefaults}
        range={timeRange}
        refreshToken={refreshToken}
        paused={
          helpOpen ||
          signalTickerEditorOpen ||
          pickerContext !== null ||
          activeDetailTable !== null
        }
        onOpenEditor={openSignalTickerEditor}
      />

      {/* Customer-pinned, app-local drill-down. Hidden by default
                to keep the overview focused on the Signal Rail and main
                content; operators can re-enable it from Signal Rail
                settings when they want a persistent next-step CTA. */}
      {signalTickerConfig.showPriorityDrilldown ? (
        <div
          data-testid="priority-drilldown-row"
          className="scd-c3-toolbar group flex-shrink-0 relative block border-b  sui-border-info   sui-bg-section sui-hover-bg-info transition-colors focus:outline-none focus-visible:ring-2 sui-focus-visible-ring focus-visible:ring-inset"
        >
          <div
            aria-hidden="true"
            className="absolute left-0 top-0 bottom-0 w-1  sui-bg-accent"
          />
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 pl-5 pr-4 py-2">
            <a
              href={featuredDrilldownHref}
              target="_blank"
              rel="noopener noreferrer"
              title={`Open ${selectedPriorityDrilldown.title} in a new tab`}
              aria-label={`Open ${selectedPriorityDrilldown.title} in a new tab`}
              className="min-w-0 h-7 flex items-center gap-3 rounded-sm focus:outline-none focus-visible:ring-2 sui-focus-visible-ring"
            >
              <div className="flex-shrink-0 w-7 h-7 rounded sui-bg-notification-info sui-color-active flex items-center justify-center shadow-sm">
                <ClipboardCheck className="w-4 h-4 sui-stroke-default" />
              </div>
              <span className="text-xs font-black  sui-color-info  tracking-[0.25em] whitespace-nowrap flex-shrink-0 hidden sm:inline w-[172px]">
                {PRIORITY_DRILLDOWN_LABEL}
              </span>
              <span className="sui-color-default font-bold  sui-color-active truncate min-w-0">
                {selectedPriorityDrilldown.title}
              </span>
              <span className="text-xs  sui-color-default truncate min-w-0 hidden lg:inline">
                {selectedPriorityDrilldown.description}
              </span>
            </a>
            <div className="flex items-center justify-end gap-2">
              <label className="hidden md:flex flex-shrink-0 items-center gap-1.5 h-7 !mb-0">
                <span className="sr-only">Priority drill-down dashboard</span>
                <Settings2
                  className="w-3.5 h-3.5  sui-color-muted"
                  aria-hidden="true"
                />
                <select
                  value={selectedPriorityDrilldown.viewName}
                  onChange={(e) =>
                    handlePriorityDrilldownChange(e.target.value)
                  }
                  title="Choose priority drill-down dashboard"
                  aria-label="Choose priority drill-down dashboard"
                  className="h-7 !mb-0 w-[220px] max-w-[22vw] rounded-md border  sui-border-default  sui-bg-section px-2 py-0 text-xs leading-none font-semibold  sui-color-active shadow-sm focus:outline-none focus:ring-2 sui-focus-ring"
                >
                  {APP_PRIORITY_DRILLDOWNS.map((item) => (
                    <option key={item.viewName} value={item.viewName}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>
              <a
                href={featuredDrilldownHref}
                target="_blank"
                rel="noopener noreferrer"
                title={`Open ${selectedPriorityDrilldown.title} in a new tab`}
                aria-label={`Open ${selectedPriorityDrilldown.title} in a new tab`}
                data-testid="featured-report-cta"
                className="h-7 flex-shrink-0 inline-flex items-center gap-1.5 px-3 rounded scd-action-primary text-xs font-bold tracking-wide shadow-sm transition-colors focus:outline-none focus-visible:ring-2 sui-focus-visible-ring"
              >
                {PRIORITY_DRILLDOWN_CTA}
                <ArrowRight className="w-3.5 h-3.5 sui-stroke-current" />
              </a>
            </div>
          </div>
        </div>
      ) : null}

      {/* Edge-to-edge layout: no `max-w` clamp and only a thin
                horizontal gutter. The previous `max-w-[1600px] mx-auto`
                left half-inch margins on either side at executive-
                display resolutions; widening lets the metric tiles and
                map breathe to fill the screen. The viewport gets a 6px
                gutter on each side (just enough to keep the section
                cards from touching the chrome border) and the splitter
                drives column widths from there.
                
                Below ~1120px the layout collapses to a single stacked
                column so the splitter never strands the map or tiles in
                a slim phone-sized strip. The exact breakpoint lives in
                tailwind.css because it sits between Tailwind's stock lg
                and xl stops. */}
      <main
        className={cn(
          "flex-1 min-h-[400px] w-full overflow-y-auto overflow-x-hidden",
          compactDensity ? "py-1.5" : "py-2",
        )}
      >
        <div
          ref={splitContainerRef}
          data-map-position={activeMapPosition}
          className={cn(
            // Map placement is now operator-configurable. Three
            // modes are wired to the segmented control in the
            // map card header (default `below`):
            //   • right  — original split-pane behaviour, side-
            //              by-side at xl+, stacked below on
            //              smaller widths. Drag splitter to
            //              rebalance.
            //   • below  — tiles on top, map below. No
            //              breakpoint switch — same layout at
            //              every width.
            //   • above  — same as below but with the column
            //              order reversed so the map sits on
            //              top. Uses `flex-col-reverse` rather
            //              than rearranging the JSX so the
            //              splitter logic stays attached to
            //              its sibling.
            // Fill the viewport when content is short, but allow the split
            // row to grow to the map and KPI cards' natural height.
            "scd-overview-split flex gap-2 min-h-full relative",
            mapVisible
              ? mapPosition === "right"
                ? "flex-col xl:flex-row"
                : mapPosition === "above"
                  ? "flex-col-reverse"
                  : "flex-col"
              : "flex-col",
          )}
          style={splitStyle}
        >
          {/* Left column — configurable metric sections.
                        In right mode at xl+ widths the column width is
                        driven by the --scd-left-pct CSS variable, which
                        the splitter updates on drag. In below/above modes
                        the column is full-width and its *height* is
                        driven by `leftPct` via an inline flex-basis (we
                        can't reuse the CSS var because Tailwind's
                        responsive variants don't conditionally swap
                        width vs height cleanly). The map column then
                        takes the remainder via `flex-1`, which gives
                        the same drag-to-resize feel vertically as the
                        existing right-mode splitter delivers
                        horizontally. */}
          <OverviewMetricsColumn
            // overflow-y-auto: when the viewport is too short
            // to fit visible sections at their min-h-[180px]
            // floor (plus ticker + header +
            // gap), the metric column scrolls vertically
            // instead of squishing the chart canvases below
            // readability. The map column keeps its own
            // height so the topology stays anchor-visible.
            // Below xl in `right` mode, the layout has
            // already collapsed to a stacked column anyway,
            // so this overflow rule applies in every mode.
            // overflow-x-hidden prevents a horizontal
            // scrollbar from showing up due to the cards'
            // shadow bleed at narrow widths.
            className={cn(
              "scd-overview-metrics flex flex-col gap-3 min-h-0 min-w-0 w-full overflow-y-auto overflow-x-hidden",
              mapVisible && mapPosition === "right"
                ? "xl:w-[var(--scd-left-pct)] xl:flex-shrink-0"
                : "",
            )}
            data-map-position={activeMapPosition}
            style={verticalMetricsStyle}
          >
            {visibleSections.map((section, sectionIndex) => {
              const meta = effectiveSectionMeta[section];
              const allSectionMetrics = renderMetricConfig.filter(
                (m) => m.section === section,
              );
              const locallyAddedSearchbaseIds = new Set(
                getSectionTileAdditions(section),
              );
              // The pill's max is whichever is smaller —
              // the global cap (sectionTileBounds.maxCount)
              // or what the searchbase-backed catalogue actually offers for
              // this section. This keeps the UI honest if
              // someone trims a section to fewer tiles in
              // searchbase.conf without touching this code.
              const sectionMaxAvailable = Math.min(
                sectionTileBounds.maxCount,
                allSectionMetrics.length,
              );
              const visibleCount = Math.min(
                sectionTileCounts[section],
                sectionMaxAvailable,
              );
              const isShowingAllTiles =
                Boolean(showAllTileSections[section]) &&
                sectionMaxAvailable > visibleCount;
              const renderedTileCount = isShowingAllTiles
                ? sectionMaxAvailable
                : visibleCount;
              const wrapTiles = renderedTileCount >= SECTION_WRAP_TILE_COUNT;
              const estimatedTileRows = wrapTiles
                ? Math.ceil(renderedTileCount / SECTION_WRAPPED_TILE_COLUMNS)
                : 1;
              const isSectionFocused = focusedSection === section;
              const isSectionCollapsed = isSectionFocused
                ? false
                : Boolean(collapsedSections[section] || focusedSection);
              const heightLevel =
                sectionHeights[section] ?? sectionHeightBounds.defaultLevel;
              const isCompactHeight =
                heightLevel === sectionHeightBounds.minLevel;
              const renderCompactHeight = isCompactHeight && !isSectionFocused;
              const baseMinHeight = renderCompactHeight
                ? SECTION_HEIGHT_H1_BASE_PX
                : compactDensity
                  ? SECTION_HEIGHT_COMPACT_BASE_PX
                  : SECTION_HEIGHT_BASE_PX;
              const wrappedRowStep = renderCompactHeight
                ? SECTION_WRAPPED_H1_TILE_ROW_STEP_PX
                : SECTION_WRAPPED_TILE_ROW_STEP_PX;
              const tilePageCount = meaningfulTilePageCount(
                sectionMaxAvailable,
                visibleCount,
                Math.min(sectionTileBounds.minCount, sectionMaxAvailable),
              );
              const sectionMinHeight =
                baseMinHeight +
                (heightLevel - sectionHeightBounds.minLevel) *
                  SECTION_HEIGHT_STEP_PX +
                (estimatedTileRows - 1) * wrappedRowStep +
                (isShowingAllTiles || tilePageCount > 1 ? tilePagerHeight : 0);

              // Apply the user's drag-reorder
              // preference (if any) to the canonical
              // tile list, then select the current page
              // or the temporary show-all set. The id-keyed `byId` lookup lets
              // the render iterate ordered ids while
              // still resolving each id back to its
              // full MetricConfig — no per-iteration
              // .find() scan.
              const canonicalIds = getFactoryTileOrder(
                section,
                allSectionMetrics,
              );
              const orderedIds = getSectionTileOrder(section, canonicalIds);
              const catalogueIds = orderedIds.slice(0, sectionMaxAvailable);
              const tilePage = Math.min(
                sectionTilePages[section] ?? 0,
                tilePageCount - 1,
              );
              const tilePageStart = isShowingAllTiles
                ? 0
                : tilePage * visibleCount;
              const visibleIds = isShowingAllTiles
                ? catalogueIds
                : catalogueIds.slice(
                    tilePageStart,
                    tilePageStart + visibleCount,
                  );
              const tilePageEnd = tilePageStart + visibleIds.length;
              const byId = new Map(allSectionMetrics.map((m) => [m.id, m]));
              let sectionFlexGrow = heightLevel;
              if (isSectionCollapsed) sectionFlexGrow = 0;
              if (isSectionFocused) {
                sectionFlexGrow = sectionHeightBounds.maxLevel;
              }

              // Drag handler scoped to this section: dnd-kit
              // emits the dragged id and the id it was
              // dropped over. We translate that into a
              // reordered array of *all* tile ids (visible
              // + hidden) so that ordering preferences
              // survive a count change. Dropping outside the
              // sortable context is a no-op (`over === null`).
              const handleDragEnd = (event: DragEndEvent) => {
                const { active, over } = event;
                if (!over || active.id === over.id) return;
                const fromIdx = orderedIds.indexOf(String(active.id));
                const toIdx = orderedIds.indexOf(String(over.id));
                if (fromIdx < 0 || toIdx < 0) return;
                const next = arrayMove(orderedIds, fromIdx, toIdx);
                setSectionTileOrder(section, next);
              };

              return (
                <DashboardSection
                  key={section}
                  title={meta.title}
                  linkText={meta.linkText}
                  href={meta.href}
                  // Height level influences both
                  // proportional growth on roomy
                  // screens and the hard min-height
                  // floor that triggers metric-column
                  // scrolling on short screens.
                  style={{
                    flexGrow: sectionFlexGrow,
                    flexShrink: 0,
                    minHeight: isSectionCollapsed ? 42 : sectionMinHeight,
                  }}
                  height={{
                    value: heightLevel,
                    min: sectionHeightBounds.minLevel,
                    max: sectionHeightBounds.maxLevel,
                    onChange: (next) => setSectionHeight(section, next),
                    label: `${meta.title} height`,
                  }}
                  wrapTiles={wrapTiles}
                  compactHeight={renderCompactHeight}
                  collapsed={isSectionCollapsed}
                  focused={isSectionFocused}
                  onToggleCollapsed={() => toggleSectionCollapsed(section)}
                  onToggleFocus={() => toggleSectionFocus(section)}
                  tilePager={
                    sectionMaxAvailable > visibleCount
                      ? {
                          page: tilePage,
                          pageCount: tilePageCount,
                          start: tilePageStart,
                          end: tilePageEnd,
                          total: sectionMaxAvailable,
                          showingAll: isShowingAllTiles,
                          onPageChange: (next) =>
                            setSectionTilePage(section, next),
                          onToggleShowAll: () =>
                            toggleSectionShowAllTiles(section),
                        }
                      : undefined
                  }
                  tileCount={
                    sectionMaxAvailable > 0
                      ? {
                          value: visibleCount,
                          min: Math.min(
                            sectionTileBounds.minCount,
                            sectionMaxAvailable,
                          ),
                          max: sectionMaxAvailable,
                          onChange: (next) =>
                            changeSectionTileCount(section, next),
                          label: `${meta.title} tiles`,
                        }
                      : undefined
                  }
                  addTileAction={{
                    label: `Add search to ${meta.title}`,
                    title: `Add search to ${meta.title}`,
                    onClick: (returnFocus) => {
                      addTileReturnFocusRef.current = returnFocus;
                      setLastAddTileSection(section);
                      setAddTileSection(section);
                    },
                  }}
                  onEditTitle={
                    canManageSharedTopology
                      ? () => setSectionTitlesEditorOpen(true)
                      : undefined
                  }
                >
                  {!isSectionCollapsed && (
                    <DndContext
                      sensors={dndSensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={visibleIds}
                        strategy={
                          wrapTiles
                            ? rectSortingStrategy
                            : horizontalListSortingStrategy
                        }
                      >
                        {visibleIds.length === 0 && (
                          <div className="flex flex-1 items-center justify-center rounded-md border border-dashed   px-4 text-center text-xs font-semibold  sui-border-default sui-bg-popup sui-color-muted">
                            No tiles configured.
                          </div>
                        )}
                        {visibleIds.map((id, idx) => {
                          const cfg = byId.get(id);
                          if (!cfg) return null;
                          const isLocalAddition = cfg.searchbaseId
                            ? locallyAddedSearchbaseIds.has(cfg.searchbaseId) &&
                              cfg.id ===
                                overviewAdditionTileId(
                                  section,
                                  cfg.searchbaseId,
                                )
                            : false;
                          return (
                            <SortableMetricCard
                              key={cfg.id}
                              id={cfg.id}
                              ariaLabel={cfg.label}
                              tileAction={{
                                kind: isLocalAddition ? "remove" : "hide",
                                label: isLocalAddition
                                  ? `Remove ${cfg.label}`
                                  : `Hide ${cfg.label}`,
                                onClick: () =>
                                  isLocalAddition && cfg.searchbaseId
                                    ? removeAddedSearchbaseIdFromSection(
                                        section,
                                        cfg.searchbaseId,
                                      )
                                    : handleHideTileFromSection(cfg),
                              }}
                              className={
                                wrapTiles
                                  ? cn(
                                      "min-w-[240px] md:min-w-[250px]",
                                      renderCompactHeight
                                        ? "min-h-[124px]"
                                        : "min-h-[148px]",
                                    )
                                  : undefined
                              }
                            >
                              <MetricCard
                                cfg={cfg}
                                dispatchPriority={10 + sectionIndex * 10}
                                range={timeRange}
                                refreshToken={refreshToken}
                                onStatus={reportStatus}
                                // Anchor the tooltip to the right
                                // edge for the last metric so the
                                // popover stays inside the section
                                // card instead of overflowing.
                                infoAnchor={
                                  idx === visibleIds.length - 1
                                    ? "right"
                                    : "auto"
                                }
                                override={overrides[cfg.id]}
                                searchbaseByName={runtimeSearchbaseByName}
                                searchbaseById={runtimeSearchbaseById}
                                searchbaseDrilldowns={searchbaseDrilldowns}
                                compactDensity={
                                  !isSectionFocused &&
                                  (compactDensity || renderCompactHeight)
                                }
                                onOpenDetailTable={setActiveDetailTable}
                                onConfigure={(returnFocus) =>
                                  openPicker(
                                    cfg.id,
                                    cfg.label,
                                    {
                                      savedSearch: cfg.savedSearch,
                                      valueField: cfg.valueField,
                                      defaultThresholds: cfg.thresholds,
                                      unit: cfg.unit,
                                      section: cfg.section,
                                    },
                                    returnFocus,
                                  )
                                }
                              />
                            </SortableMetricCard>
                          );
                        })}
                      </SortableContext>
                    </DndContext>
                  )}
                </DashboardSection>
              );
            })}
          </OverviewMetricsColumn>

          {/* The SUI-tokenized rule remains the interactive split control. */}
          {mapVisible && (
            <SplitSeparator
              role="separator"
              tabIndex={0}
              aria-orientation={isVerticalSplit ? "horizontal" : "vertical"}
              aria-label="Resize tiles vs map"
              aria-valuenow={Math.round(leftPct)}
              aria-valuemin={SPLIT_MIN}
              aria-valuemax={SPLIT_MAX}
              title="Drag to resize · arrows ±1% · double-click to reset"
              onMouseDown={beginDrag}
              onKeyDown={onSplitterKeyDown}
              onDoubleClick={resetSplit}
              className={cn(
                "scd-overview-splitter focus:outline-none",
                // Right mode hides the splitter on sub-xl
                // widths because the layout collapses to a
                // single column there. Vertical modes
                // never collapse, so the splitter is
                // always visible in those.
                mapPosition === "right" && "hidden xl:block",
              )}
              $horizontal={isVerticalSplit}
              data-map-position={mapPosition}
            />
          )}

          {/* Map column.
                        right mode: width is the complement of leftPct
                        on xl+, full width below xl. below/above modes:
                        full width, height is the complement of leftPct
                        because the tiles column carries an explicit
                        flex-basis of leftPct% and the map fills the
                        remainder via flex-1. Both columns set min-w-0
                        so a long word in a metric label or a wide map
                        tile can't blow the column wider than its
                        share. */}
          {mapVisible && (
            <div
              className={cn(
                "scd-overview-map flex flex-col min-h-0 min-w-0 w-full",
                mapPosition === "right" ? "xl:flex-1" : "flex-1",
              )}
              data-map-position={mapPosition}
              data-map-height={mapHeightMode}
              style={verticalMapStyle}
            >
              <div
                className={cn(
                  "scd-c3-panel sui-bg-section rounded-lg border sui-border-weak p-3 shadow-sm flex flex-col",
                  mapHeightMode === "match-workspace" && "flex-1 min-h-0",
                )}
              >
                <div className="mb-2 flex flex-shrink-0 flex-wrap items-start justify-between gap-2">
                  <div className="min-w-[12rem] flex-1">
                    <Heading
                      level={2}
                      variant="title3"
                      data-sui-heading-variant="title3"
                    >
                      {topologyHeaderName}
                    </Heading>
                    <p className="text-xs  sui-color-muted font-medium mt-0.5">
                      {topologyHeaderSubtitle}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <RegionalViewToggle
                      value={regionalView}
                      onChange={updateRegionalView}
                    />
                  </div>
                </div>

                {regionalView === "map" ? (
                  <MapViewport>
                    {/* Build 1190 — render the live map
                                       during export instead of swapping
                                       to TopologySiteTable. The Build
                                       1186 substitute approach was
                                       overcorrecting on the original
                                       export complaint: the operator
                                       wanted the *map with sites and
                                       connectivity lines* in the export,
                                       just without the broken-mid-frame
                                       SMIL animation artifacts. The
                                       SMIL pause in `useExportPage`
                                       (still active) freezes the
                                       stroke-dashoffset flow lines at a
                                       clean keyframe; html2canvas
                                       rasterises the underlying Leaflet
                                       tiles + the static SVG paths
                                       cleanly. The CSS animation freeze
                                       in `tailwind.css` covers any
                                       remaining keyframe-driven motion.
                                       The previous `data-export-hide` /
                                       `data-export-placeholder`
                                       attributes have been removed; the
                                       generic CSS rules that consume
                                       them are kept in `tailwind.css`
                                       so other components can opt in
                                       to the same swap pattern in the
                                       future. */}
                    <CustomerTopologyMap
                      key={`${insightsWorkspace.id}-${topologyResetKey}`}
                      topology={workspaceTopology}
                      canManageTopology={canManageSharedTopology}
                      earliestTime={timeRange.earliest}
                      latestTime={timeRange.latest}
                      refreshToken={refreshToken}
                      onOpenInSearch={(spl, appContext) => {
                        const url = splunkSearchAppUrl(
                          spl,
                          timeRange,
                          appContext,
                        );
                        if (typeof window !== "undefined") {
                          window.open(url, "_blank", "noopener,noreferrer");
                        }
                      }}
                    />
                  </MapViewport>
                ) : (
                  <div className="flex-1 min-h-0">
                    <TopologySiteTable topology={workspaceTopology} />
                  </div>
                )}

                {mapPrimaryBaseCfg || mapSecondaryBaseCfg ? (
                  <div className="mt-3 grid grid-cols-2 gap-3 flex-shrink-0">
                    {mapPrimaryBaseCfg ? (
                      <KpiCard
                        label={effectiveMapPrimaryCfg.label}
                        value={mapPrimary.value}
                        searchbaseId={
                          resolveSearchbaseRecordForConfig(
                            effectiveMapPrimaryCfg,
                            runtimeSearchbaseById,
                            runtimeSearchbaseByName,
                          )?.id
                        }
                        status={mapFooterStatus(
                          mapPrimary.value,
                          effectiveMapPrimaryCfg.thresholds,
                        )}
                        onOpenInSearch={
                          effectiveMapPrimaryCfg.spl
                            ? () =>
                                window.open(
                                  splunkSearchAppUrl(
                                    effectiveMapPrimaryCfg.spl as string,
                                    timeRange,
                                    effectiveMapPrimaryCfg.dispatchContext,
                                  ),
                                  "_blank",
                                  "noopener,noreferrer",
                                )
                            : undefined
                        }
                        onConfigure={
                          canManageFactoryConfig
                            ? (returnFocus) =>
                                openPicker(
                                  mapPrimaryBaseCfg.id,
                                  effectiveMapPrimaryCfg.label,
                                  {
                                    savedSearch: mapPrimaryBaseCfg.savedSearch,
                                    valueField:
                                      effectiveMapPrimaryCfg.valueField,
                                    defaultThresholds:
                                      effectiveMapPrimaryCfg.thresholds,
                                    unit: effectiveMapPrimaryCfg.unit,
                                    allowPersonalDisplayControls: false,
                                  },
                                  returnFocus,
                                )
                            : undefined
                        }
                      />
                    ) : null}
                    {mapSecondaryBaseCfg ? (
                      <KpiCard
                        label={effectiveMapSecondaryCfg.label}
                        value={mapSecondary.value}
                        searchbaseId={
                          resolveSearchbaseRecordForConfig(
                            effectiveMapSecondaryCfg,
                            runtimeSearchbaseById,
                            runtimeSearchbaseByName,
                          )?.id
                        }
                        status={mapFooterStatus(
                          mapSecondary.value,
                          effectiveMapSecondaryCfg.thresholds,
                        )}
                        onOpenInSearch={
                          effectiveMapSecondaryCfg.spl
                            ? () =>
                                window.open(
                                  splunkSearchAppUrl(
                                    effectiveMapSecondaryCfg.spl as string,
                                    timeRange,
                                    effectiveMapSecondaryCfg.dispatchContext,
                                  ),
                                  "_blank",
                                  "noopener,noreferrer",
                                )
                            : undefined
                        }
                        onConfigure={
                          canManageFactoryConfig
                            ? (returnFocus) =>
                                openPicker(
                                  mapSecondaryBaseCfg.id,
                                  effectiveMapSecondaryCfg.label,
                                  {
                                    savedSearch:
                                      mapSecondaryBaseCfg.savedSearch,
                                    valueField:
                                      effectiveMapSecondaryCfg.valueField,
                                    defaultThresholds:
                                      effectiveMapSecondaryCfg.thresholds,
                                    unit: effectiveMapSecondaryCfg.unit,
                                    allowPersonalDisplayControls: false,
                                  },
                                  returnFocus,
                                )
                            : undefined
                        }
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </main>

      <HelpOverlay
        open={helpOpen}
        onClose={closeHelp}
        shortcuts={helpShortcutRows}
      />

      <WorkspaceManager
        open={workspaceManagerOpen}
        returnFocus={workspaceToggleRef}
        currentWorkspace={insightsWorkspace}
        workspaces={workspaces}
        layouts={layouts}
        signalRails={signalRails}
        onClose={() => setWorkspaceManagerOpen(false)}
        onWorkspaceSaved={(workspaceId) => {
          if (workspaceId === insightsWorkspace.id) {
            window.location.reload();
            return;
          }
          handleInsightsWorkspaceChange(workspaceId);
        }}
        onWorkspaceDeleted={(workspaceId) => {
          if (workspaceId === insightsWorkspace.id) {
            handleInsightsWorkspaceChange("secure_networking");
            return;
          }
          window.location.reload();
        }}
      />

      {addTilePickerState && (
        <OverviewAddTilePanel
          open={addTileSection !== null}
          profile={insightsWorkspace}
          section={addTilePickerState.section}
          sectionTitle={addTilePickerState.sectionTitle}
          records={allSearchbaseRecords ?? []}
          loading={searchbaseRecords === null || allSearchbaseRecords === null}
          currentAppOwner={currentSearchbaseOwnerApp}
          currentSearchbaseIds={addTilePickerState.currentSearchbaseIds}
          hiddenSearchbaseIds={addTilePickerState.hiddenSearchbaseIds}
          locallyAddedSearchbaseIds={
            addTilePickerState.locallyAddedSearchbaseIds
          }
          workspaceAddedSearchbaseIds={
            addTilePickerState.workspaceAddedSearchbaseIds
          }
          currentVisibleCount={addTilePickerState.currentVisibleCount}
          currentConfiguredCount={addTilePickerState.currentConfiguredCount}
          canManageWorkspace={canManageWorkspaceConfig}
          returnFocus={addTileReturnFocusRef}
          onAdd={(record, destination) =>
            handleAddSearchToSection(
              addTilePickerState.section,
              record,
              destination,
            )
          }
          onRemove={(record) =>
            handleRemoveAddedSearchFromSection(
              addTilePickerState.section,
              record,
            )
          }
          onRemoveWorkspace={(record) =>
            handleRemoveSharedSearchFromSection(
              addTilePickerState.section,
              record,
            )
          }
          onUnhide={(record) =>
            handleShowSearchInSection(addTilePickerState.section, record)
          }
          onClose={closeAddTilePicker}
        />
      )}

      <KpiPickerPanel
        open={pickerContext !== null}
        context={pickerContext}
        returnFocus={pickerReturnFocusRef}
        onClose={closePicker}
        onApply={handlePickerApply}
        onApplyDisplayToSection={handleApplyDisplayToSection}
        drilldownBindings={searchbaseDrilldowns}
        onClearOverride={(tileId) => {
          clearOverride(tileId);
          closePicker();
        }}
        onTestInSearch={(spl, appContext) => {
          // Open Splunk Search & Reporting with the *literal*
          // SPL pulled from `searchbase.conf` — the executive
          // sees-and-tests exactly what the picker is showing
          // them, no savedsearch-command indirection. Open in a
          // new tab so the picker stays open for further
          // browsing. URLSearchParams handles encoding of
          // backticks, quotes, pipes, and embedded newlines.
          if (!spl) return;
          const url = splunkSearchAppUrl(spl, timeRange, appContext);
          if (typeof window !== "undefined") {
            window.open(url, "_blank", "noopener,noreferrer");
          }
        }}
        onResetAllCustomizations={handleResetAllCustomizations}
        onPublishWorkspaceLayout={
          canManageWorkspaceConfig ? handlePublishWorkspaceLayout : undefined
        }
        workspaceLayoutStatus={workspaceLayoutStatus}
        canManageFactoryConfig={canManageFactoryConfig}
        onSaveFactoryTileConfig={handleSaveFactoryTileConfig}
        factoryTileConfigStatus={factoryTileConfigStatus}
      />

      <SignalTickerEditor
        open={signalTickerEditorOpen}
        config={signalTickerConfig}
        catalogue={searchbaseCatalogue}
        metricDefaultsBySearchName={signalTickerMetricDefaults}
        catalogueLoading={visibleSearchbaseCatalogue === null}
        range={timeRange}
        includeHiddenSearches={signalTickerIncludeHiddenSearches}
        includeDrilldownSearches={signalTickerIncludeDrilldownSearches}
        includeTableSearches={signalTickerIncludeTableSearches}
        onIncludeHiddenSearchesChange={setSignalTickerIncludeHiddenSearches}
        onIncludeDrilldownSearchesChange={
          setSignalTickerIncludeDrilldownSearches
        }
        onIncludeTableSearchesChange={setSignalTickerIncludeTableSearches}
        onChange={setSignalTickerConfig}
        onReset={resetSignalTickerConfig}
        isWorkspaceDefault={signalTickerIsWorkspaceDefault}
        persistenceStatus={signalTickerPersistenceStatus}
        persistenceError={signalTickerPersistenceError}
        sharedCatalog={canManageWorkspaceConfig}
        onClose={() => setSignalTickerEditorOpen(false)}
      />

      {activeDetailTable && (
        <MetricDetailTableModal
          config={activeDetailTable}
          onClose={() => setActiveDetailTable(null)}
          range={timeRange}
          refreshToken={refreshToken}
        />
      )}

      <BrandingEditorModal
        isOpen={isBrandingEditorOpen}
        onClose={() => setBrandingEditorOpen(false)}
        override={{
          title: insightsWorkspace.headerTitle || insightsWorkspace.label,
          subtitle: insightsWorkspace.headerSubtitle,
          logoDataUri: insightsWorkspace.defaultLogoSrc,
        }}
        titlePlaceholder={
          insightsWorkspace.headerTitle ||
          insightsWorkspace.label ||
          DEFAULT_HEADER_TITLE_FALLBACK
        }
        subtitlePlaceholder={
          insightsWorkspace.headerSubtitle || DEFAULT_HEADER_SUBTITLE
        }
        logoFallbackSrc={logoSrc}
        onSave={async (next) => {
          if (!canManageWorkspaceConfig) return false;
          const saved = await persistWorkspacePatch({
            headerTitle: next.title,
            headerSubtitle: next.subtitle,
            defaultLogoSrc:
              next.logoDataUri ?? insightsWorkspace.defaultLogoSrc,
            hideDefaultLogo: next.logoDataUri
              ? false
              : insightsWorkspace.hideDefaultLogo,
          });
          if (!saved) return false;
          resetBrandingOverride();
          return true;
        }}
        onResetToDefaults={() => {
          const packaged = PACKAGED_WORKSPACE_FALLBACKS.find(
            (candidate) => candidate.id === insightsWorkspace.id,
          );
          void persistWorkspacePatch({
            headerTitle: packaged?.headerTitle || insightsWorkspace.label,
            headerSubtitle: packaged?.headerSubtitle,
            defaultLogoSrc: packaged?.defaultLogoSrc,
            hideDefaultLogo:
              packaged?.hideDefaultLogo ?? insightsWorkspace.hideDefaultLogo,
          });
          resetBrandingOverride();
          setBrandingEditorOpen(false);
        }}
      />

      <SectionTitlesEditorModal
        isOpen={isSectionTitlesEditorOpen}
        onClose={() => setSectionTitlesEditorOpen(false)}
        values={sectionTitles}
        defaults={DEFAULT_CUSTOMER_TOPOLOGY_SECTION_TITLES}
        visibleSections={visibleSections}
        availableSections={availableSections}
        maxSections={maxVisibleSections}
        onSave={async (next) => {
          await saveSectionTitles(next);
          setSectionTitlesEditorOpen(false);
        }}
        onResetToDefaults={async () => {
          await saveSectionTitles(DEFAULT_CUSTOMER_TOPOLOGY_SECTION_TITLES);
          setSectionTitlesEditorOpen(false);
        }}
        onLayoutChange={setVisibleSections}
        onResetLayout={resetAllSectionLayout}
      />
    </div>
  );
};

// =============================================================================
// Section add-search drawer
// =============================================================================

const ALL_ADD_TILE_CATEGORIES = "__all_add_tile_categories";
const ALL_ADD_TILE_SUB_CATEGORIES = "__all_add_tile_sub_categories";

// Start the cross-app catalogue on this app. Operators can still add other
// installed Searchbase providers from the App multiselect, while reopening or
// clearing the drawer returns to the app-owned catalogue.
const makeDefaultAddTileAppSelection = (
  currentAppOwner: string,
): Set<string> => {
  const app = currentAppOwner.trim();
  return new Set(app ? [app] : []);
};

const isDefaultAddTileAppSelection = (
  selection: ReadonlySet<string>,
  currentAppOwner: string,
): boolean => {
  const app = currentAppOwner.trim();
  return app ? selection.size === 1 && selection.has(app) : selection.size === 0;
};

const recordMatchesAddTileAppSelection = (
  record: SearchbaseRecord,
  selection: ReadonlySet<string>,
): boolean => selection.size === 0 || selection.has(record.catalogueApp);

const recordHasTag = (record: SearchbaseRecord, tagName: string): boolean =>
  record.tags.some((tag) => tag.toLowerCase() === tagName.toLowerCase());

const recordMatchesProfileScope = (
  record: SearchbaseRecord,
  profile: InsightsWorkspace,
): boolean => {
  if (!record.search?.trim()) return false;
  if (
    overviewDefinitionsFromRecord(record).some((definition) =>
      overviewDefinitionMatchesWorkspace(definition, profile),
    )
  ) {
    return true;
  }
  const requiredTag = profile.autoDiscovery?.requiredTag;
  return requiredTag ? recordHasTag(record, requiredTag) : true;
};

const recordMatchesProfileSection = (
  record: SearchbaseRecord,
  profile: InsightsWorkspace,
  section: SectionId,
): boolean => {
  const explicitOverviewMatch = overviewDefinitionsFromRecord(record).some(
    (definition) =>
      overviewDefinitionMatchesWorkspace(definition, profile) &&
      parseOverviewSection(definition.section, profile) === section,
  );
  if (explicitOverviewMatch) return true;

  const auto = profile.autoDiscovery;
  if (!auto) return true;
  return record.subCategory
    ? auto.subCategoryToSection[record.subCategory] === section
    : false;
};

const recordIsAddTileDrilldownSearch = (
  record: SearchbaseRecord,
  drilldownSearchNames: ReadonlySet<string>,
): boolean =>
  drilldownSearchNames.has(record.searchName.trim().toLowerCase()) ||
  drilldownSearchNames.has(record.id.trim().toLowerCase());

const recordMatchesAddTileVisibility = (
  record: SearchbaseRecord,
  drilldownSearchNames: ReadonlySet<string>,
  includeDrilldownSearches: boolean,
  includeTableSearches: boolean,
): boolean => {
  if (
    !includeDrilldownSearches &&
    recordIsAddTileDrilldownSearch(record, drilldownSearchNames)
  ) {
    return false;
  }
  if (
    !includeTableSearches &&
    (record.defaultViz ?? "").trim().toLowerCase() === "splunk.table"
  ) {
    return false;
  }
  return true;
};

const recordMatchesAddTileQuery = (
  record: SearchbaseRecord,
  query: string,
): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const description =
    plainTextFromHtml(record.explanation) ??
    plainTextFromHtml(record.description) ??
    "";
  return (
    record.searchName.toLowerCase().includes(q) ||
    record.id.toLowerCase().includes(q) ||
    record.category.toLowerCase().includes(q) ||
    record.subCategory.toLowerCase().includes(q) ||
    description.toLowerCase().includes(q) ||
    record.tags.some((tag) => tag.toLowerCase().includes(q))
  );
};

interface OverviewAddTilePanelProps {
  open: boolean;
  profile: InsightsWorkspace;
  section: SectionId;
  sectionTitle: string;
  records: SearchbaseRecord[];
  loading: boolean;
  currentAppOwner: string;
  currentSearchbaseIds: ReadonlySet<string>;
  hiddenSearchbaseIds: ReadonlySet<string>;
  locallyAddedSearchbaseIds: ReadonlySet<string>;
  workspaceAddedSearchbaseIds: ReadonlySet<string>;
  currentVisibleCount: number;
  currentConfiguredCount: number;
  canManageWorkspace: boolean;
  returnFocus: React.MutableRefObject<HTMLElement | null>;
  onAdd: (
    record: SearchbaseRecord,
    destination: "personal" | "workspace",
  ) => void | Promise<void>;
  onRemove: (record: SearchbaseRecord) => void;
  onRemoveWorkspace: (record: SearchbaseRecord) => void | Promise<void>;
  onUnhide: (record: SearchbaseRecord) => void;
  onClose: () => void;
}

// Splunk Web's legacy input rule outranks SUI, so restore the themed search background here.
const StyledSearch = styled(SearchInput)`
  && input[role="searchbox"] {
    background-color: ${variables.transparent};
  }
`;

const OverviewAddTilePanel: React.FC<OverviewAddTilePanelProps> = ({
  open,
  profile,
  section,
  sectionTitle,
  records,
  loading,
  currentAppOwner,
  currentSearchbaseIds,
  hiddenSearchbaseIds,
  locallyAddedSearchbaseIds,
  workspaceAddedSearchbaseIds,
  currentVisibleCount,
  currentConfiguredCount,
  canManageWorkspace,
  returnFocus,
  onAdd,
  onRemove,
  onRemoveWorkspace,
  onUnhide,
  onClose,
}) => {
  const theme = useSplunkTheme();
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(
    ALL_ADD_TILE_CATEGORIES,
  );
  const [selectedSubCategory, setSelectedSubCategory] = useState(
    ALL_ADD_TILE_SUB_CATEGORIES,
  );
  const [selectedApps, setSelectedApps] = useState<Set<string>>(
    () => makeDefaultAddTileAppSelection(currentAppOwner),
  );
  const [includeHiddenSearches, setIncludeHiddenSearches] = useState(false);
  const [includeDrilldownSearches, setIncludeDrilldownSearches] =
    useState(false);
  const [includeTableSearches, setIncludeTableSearches] = useState(false);
  const [activeTags, setActiveTags] = useState<Set<string>>(() => new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [addDestination, setAddDestination] = useState<
    "personal" | "workspace"
  >(canManageWorkspace ? "workspace" : "personal");
  const [addingRecordId, setAddingRecordId] = useState<string | null>(null);
  const [sharedRemovalRecord, setSharedRemovalRecord] =
    useState<SearchbaseRecord | null>(null);
  const [sharedRemovalError, setSharedRemovalError] = useState<string | null>(
    null,
  );
  const [sharedRemovalSaving, setSharedRemovalSaving] = useState(false);
  const [sharedRemovalAnnouncement, setSharedRemovalAnnouncement] =
    useState("");
  const [showEntireCatalogue, setShowEntireCatalogue] = useState(false);
  const [includeAddedSearches, setIncludeAddedSearches] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const sharedRemovalReturnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelectedCategory(ALL_ADD_TILE_CATEGORIES);
    setSelectedSubCategory(ALL_ADD_TILE_SUB_CATEGORIES);
    setSelectedApps(makeDefaultAddTileAppSelection(currentAppOwner));
    setIncludeHiddenSearches(false);
    setIncludeDrilldownSearches(false);
    setIncludeTableSearches(false);
    setActiveTags(new Set());
    setFiltersOpen(false);
    setAddDestination("personal");
    setAddingRecordId(null);
    setSharedRemovalRecord(null);
    setSharedRemovalError(null);
    setSharedRemovalSaving(false);
    setSharedRemovalAnnouncement("");
    setShowEntireCatalogue(false);
    setIncludeAddedSearches(false);
    if (typeof window === "undefined") return;
    const id = window.setTimeout(() => searchInputRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [currentAppOwner, open, profile.id, section]);

  const handleAdd = async (record: SearchbaseRecord) => {
    setAddingRecordId(searchbaseRecordReference(record));
    try {
      await onAdd(record, addDestination);
    } finally {
      setAddingRecordId(null);
    }
  };

  const handleConfirmSharedRemoval = async () => {
    if (!sharedRemovalRecord || sharedRemovalSaving) return;
    const recordName = sharedRemovalRecord.searchName;
    setSharedRemovalSaving(true);
    setSharedRemovalError(null);
    setSharedRemovalAnnouncement(`Removing ${recordName} for everyone.`);
    try {
      await onRemoveWorkspace(sharedRemovalRecord);
      setSharedRemovalRecord(null);
      setSharedRemovalAnnouncement(`Removed ${recordName} for everyone.`);
    } catch (error) {
      setSharedRemovalError(
        error instanceof Error
          ? error.message
          : "Could not remove the tile for everyone.",
      );
      setSharedRemovalAnnouncement("");
    } finally {
      setSharedRemovalSaving(false);
    }
  };

  const addableRecords = useMemo(
    () =>
      records
        .filter((record) => record.search?.trim())
        .sort((a, b) =>
          a.searchName.localeCompare(b.searchName, undefined, {
            sensitivity: "base",
          }),
        ),
    [records],
  );

  const profileRecords = useMemo(
    () =>
      addableRecords.filter(
        (record) =>
          record.ownerApp === currentAppOwner &&
          recordMatchesProfileScope(record, profile),
      ),
    [addableRecords, currentAppOwner, profile],
  );

  const drilldownSearchNames = useMemo(() => {
    const names = new Set<string>();
    for (const record of addableRecords) {
      for (const rawName of record.drilldownSearchNames ?? []) {
        const name = rawName.trim();
        if (name) names.add(name.toLowerCase());
      }
    }
    return names;
  }, [addableRecords]);

  const sectionRecords = useMemo(
    () =>
      profileRecords.filter((record) =>
        recordMatchesProfileSection(record, profile, section),
      ),
    [profile, profileRecords, section],
  );

  // Suggestions stay focused on the current app and workspace section. The
  // entire catalogue spans installed Searchbase providers; additions use an
  // app-qualified reference so identical stanza ids remain unambiguous.
  const suggestedRecords =
    sectionRecords.length > 0 ? sectionRecords : profileRecords;
  const browsingEntireCatalogue =
    showEntireCatalogue || suggestedRecords.length === 0;
  const browseRecords = browsingEntireCatalogue
    ? addableRecords
    : suggestedRecords;
  const showScopeToggle =
    suggestedRecords.length > 0 &&
    addableRecords.length > suggestedRecords.length;

  const addedSearchbaseIds = useMemo(
    () =>
      new Set([
        ...currentSearchbaseIds,
        ...locallyAddedSearchbaseIds,
        ...workspaceAddedSearchbaseIds,
      ]),
    [
      currentSearchbaseIds,
      locallyAddedSearchbaseIds,
      workspaceAddedSearchbaseIds,
    ],
  );

  const isAddedSearchbaseRecord = useCallback(
    (record: SearchbaseRecord) =>
      searchbaseReferenceSetHasRecord(
        addedSearchbaseIds,
        record,
        currentAppOwner,
      ),
    [addedSearchbaseIds, currentAppOwner],
  );

  const isHiddenSearchbaseRecord = useCallback(
    (record: SearchbaseRecord) =>
      searchbaseReferenceSetHasRecord(
        hiddenSearchbaseIds,
        record,
        currentAppOwner,
      ),
    [currentAppOwner, hiddenSearchbaseIds],
  );

  const browseVisibilityRecords = useMemo(() => {
    return browseRecords.filter((record) => {
      if (
        !includeHiddenSearches &&
        (record.searchHidden || isHiddenSearchbaseRecord(record))
      ) {
        return false;
      }
      return recordMatchesAddTileVisibility(
        record,
        drilldownSearchNames,
        includeDrilldownSearches,
        includeTableSearches,
      );
    });
  }, [
    browseRecords,
    drilldownSearchNames,
    includeDrilldownSearches,
    includeHiddenSearches,
    includeTableSearches,
    isHiddenSearchbaseRecord,
  ]);

  const browseEligibleRecords = useMemo(
    () =>
      browseVisibilityRecords.filter((record) =>
        recordMatchesAddTileAppSelection(record, selectedApps),
      ),
    [browseVisibilityRecords, selectedApps],
  );

  const browseVisibleRecords = useMemo(() => {
    if (includeAddedSearches) return browseEligibleRecords;
    return browseEligibleRecords.filter(
      (record) => !isAddedSearchbaseRecord(record),
    );
  }, [browseEligibleRecords, includeAddedSearches, isAddedSearchbaseRecord]);

  const appFacetRecords = useMemo(
    () =>
      browseVisibilityRecords.filter(
        (record) => includeAddedSearches || !isAddedSearchbaseRecord(record),
      ),
    [browseVisibilityRecords, includeAddedSearches, isAddedSearchbaseRecord],
  );

  const apps = useMemo(() => {
    const set = new Set<string>();
    for (const record of appFacetRecords) {
      if (record.catalogueApp) set.add(record.catalogueApp);
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [appFacetRecords]);

  const appCountByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const record of appFacetRecords) {
      if (record.catalogueApp) {
        map.set(record.catalogueApp, (map.get(record.catalogueApp) ?? 0) + 1);
      }
    }
    return map;
  }, [appFacetRecords]);

  useEffect(() => {
    setSelectedApps((current) => {
      // Catalogue options can be temporarily empty while records are loading.
      // Do not erase the explicit app default during that transition.
      if (current.size === 0 || apps.length === 0) return current;
      const next = new Set([...current].filter((app) => apps.includes(app)));
      return next.size === current.size ? current : next;
    });
  }, [apps]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const record of browseVisibleRecords) {
      if (record.category) set.add(record.category);
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [browseVisibleRecords]);

  const subCategories = useMemo(() => {
    if (selectedCategory === ALL_ADD_TILE_CATEGORIES) return [];
    const set = new Set<string>();
    for (const record of browseVisibleRecords) {
      if (record.category !== selectedCategory) continue;
      if (record.subCategory) set.add(record.subCategory);
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [browseVisibleRecords, selectedCategory]);

  useEffect(() => {
    if (
      selectedCategory !== ALL_ADD_TILE_CATEGORIES &&
      !categories.includes(selectedCategory)
    ) {
      setSelectedCategory(ALL_ADD_TILE_CATEGORIES);
    }
  }, [categories, selectedCategory]);

  useEffect(() => {
    if (
      selectedSubCategory !== ALL_ADD_TILE_SUB_CATEGORIES &&
      !subCategories.includes(selectedSubCategory)
    ) {
      setSelectedSubCategory(ALL_ADD_TILE_SUB_CATEGORIES);
    }
  }, [selectedSubCategory, subCategories]);

  useEffect(() => {
    setSelectedSubCategory(ALL_ADD_TILE_SUB_CATEGORIES);
    setActiveTags(new Set());
  }, [selectedCategory]);

  useEffect(() => {
    setSelectedCategory(ALL_ADD_TILE_CATEGORIES);
    setSelectedSubCategory(ALL_ADD_TILE_SUB_CATEGORIES);
    setActiveTags(new Set());
  }, [selectedApps]);

  const tagFacetRecords = useMemo(() => {
    return browseVisibleRecords.filter((record) => {
      if (
        selectedCategory !== ALL_ADD_TILE_CATEGORIES &&
        record.category !== selectedCategory
      ) {
        return false;
      }
      if (
        selectedSubCategory !== ALL_ADD_TILE_SUB_CATEGORIES &&
        record.subCategory !== selectedSubCategory
      ) {
        return false;
      }
      if (activeTags.size > 0) {
        for (const tag of activeTags) {
          if (!record.tags.includes(tag)) return false;
        }
      }
      return recordMatchesAddTileQuery(record, query);
    });
  }, [
    activeTags,
    browseVisibleRecords,
    query,
    selectedCategory,
    selectedSubCategory,
  ]);

  const allTagsWithCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const record of tagFacetRecords) {
      for (const tag of record.tags) map.set(tag, (map.get(tag) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    );
  }, [tagFacetRecords]);

  const filteredRecords = useMemo(() => {
    return browseVisibleRecords.filter((record) => {
      if (
        selectedCategory !== ALL_ADD_TILE_CATEGORIES &&
        record.category !== selectedCategory
      ) {
        return false;
      }
      if (
        selectedSubCategory !== ALL_ADD_TILE_SUB_CATEGORIES &&
        record.subCategory !== selectedSubCategory
      ) {
        return false;
      }
      if (activeTags.size > 0) {
        for (const tag of activeTags) {
          if (!record.tags.includes(tag)) return false;
        }
      }
      return recordMatchesAddTileQuery(record, query);
    });
  }, [
    activeTags,
    browseVisibleRecords,
    query,
    selectedCategory,
    selectedSubCategory,
  ]);

  const matchingAddedCount = useMemo(() => {
    if (!includeAddedSearches) {
      return browseEligibleRecords.filter((record) => {
        if (!isAddedSearchbaseRecord(record)) return false;
        if (
          selectedCategory !== ALL_ADD_TILE_CATEGORIES &&
          record.category !== selectedCategory
        ) {
          return false;
        }
        if (
          selectedSubCategory !== ALL_ADD_TILE_SUB_CATEGORIES &&
          record.subCategory !== selectedSubCategory
        ) {
          return false;
        }
        if (activeTags.size > 0) {
          for (const tag of activeTags) {
            if (!record.tags.includes(tag)) return false;
          }
        }
        return recordMatchesAddTileQuery(record, query);
      }).length;
    }
    return filteredRecords.filter(isAddedSearchbaseRecord).length;
  }, [
    activeTags,
    browseEligibleRecords,
    filteredRecords,
    includeAddedSearches,
    isAddedSearchbaseRecord,
    query,
    selectedCategory,
    selectedSubCategory,
  ]);

  const matchingAddableCount = includeAddedSearches
    ? filteredRecords.length - matchingAddedCount
    : filteredRecords.length;

  const activeFilterCount =
    (showEntireCatalogue && showScopeToggle ? 1 : 0) +
    (!isDefaultAddTileAppSelection(selectedApps, currentAppOwner) ? 1 : 0) +
    (includeAddedSearches ? 1 : 0) +
    (includeHiddenSearches ? 1 : 0) +
    (includeDrilldownSearches ? 1 : 0) +
    (includeTableSearches ? 1 : 0) +
    (selectedCategory !== ALL_ADD_TILE_CATEGORIES ? 1 : 0) +
    (selectedSubCategory !== ALL_ADD_TILE_SUB_CATEGORIES ? 1 : 0) +
    activeTags.size;
  const facetsActive = activeFilterCount > 0;
  const scopeLabel = browsingEntireCatalogue ? "Entire catalogue" : "Suggested";
  const availableSearchLabel = includeAddedSearches
    ? `${scopeLabel} · ${matchingAddableCount.toLocaleString()} to add · ${matchingAddedCount.toLocaleString()} added`
    : `${scopeLabel} · ${matchingAddableCount.toLocaleString()} to add`;

  const handleClearFacets = () => {
    setSelectedApps(makeDefaultAddTileAppSelection(currentAppOwner));
    setIncludeAddedSearches(false);
    setIncludeHiddenSearches(false);
    setIncludeDrilldownSearches(false);
    setIncludeTableSearches(false);
    setSelectedCategory(ALL_ADD_TILE_CATEGORIES);
    setSelectedSubCategory(ALL_ADD_TILE_SUB_CATEGORIES);
    setActiveTags(new Set());
    setShowEntireCatalogue(false);
  };

  const handleDrawerClose = () => {
    setFiltersOpen(false);
    onClose();
  };

  const countLabel = `${currentVisibleCount} visible · ${currentConfiguredCount} configured`;

  return (
    <>
      <Drawer
        divider="header"
        material="glass"
        onRequestClose={handleDrawerClose}
        open={open}
        position="page"
        returnFocus={returnFocus}
        width="650px"
      >
        <Drawer.Header
          title="Add search"
          subtitle={`${sectionTitle} · ${countLabel}`}
        />

        <Drawer.Body className="scd-insights-layer-content">
          <div>
            <ControlGroup hideLabel label="Search">
              <StyledSearch
                aria-controls="overview-add-search-results"
                inputRef={searchInputRef}
                onChange={(_event, { value }) => setQuery(value)}
                placeholder="Search by name, description, or tag"
                value={query}
              />
            </ControlGroup>

            <ControlGroup
              controlsLayout="none"
              help={
                addDestination === "workspace"
                  ? "Adds the tile to the shared workspace for every viewer. Viewers can still personalize their view."
                  : "Only you will see the tile in this workspace and browser."
              }
              label="Visibility"
            >
              {canManageWorkspace ? (
                <RadioBar
                  onChange={(_event, { value }) =>
                    setAddDestination(value as "personal" | "workspace")
                  }
                  value={addDestination}
                >
                  <RadioBar.Option label="Add for me" value="personal" />
                  <RadioBar.Option label="Add for everyone" value="workspace" />
                </RadioBar>
              ) : (
                <StaticContent>Add for me</StaticContent>
              )}
            </ControlGroup>

            <CollapsiblePanel
              actions={
                facetsActive ? (
                  <Button
                    appearance="subtle"
                    label="Clear filters"
                    onClick={handleClearFacets}
                  />
                ) : null
              }
              appearance="subtle"
              description={availableSearchLabel}
              inset
              onChange={(_event, { action }) =>
                setFiltersOpen(action === "open")
              }
              open={filtersOpen}
              title={
                activeFilterCount > 0
                  ? `Advanced filters (${activeFilterCount} active)`
                  : "Advanced filters"
              }
            >
              {showScopeToggle && (
                <ControlGroup
                  controlsLayout="none"
                  help="Suggested matches this workspace section using searches from this app. Entire catalogue includes addable searches from every installed Searchbase provider."
                  label="Scope"
                >
                  <RadioBar
                    onChange={(_event, { value }) =>
                      setShowEntireCatalogue(value === "all")
                    }
                    value={showEntireCatalogue ? "all" : "suggested"}
                  >
                    <RadioBar.Option label="Suggested" value="suggested" />
                    <RadioBar.Option label="Entire catalogue" value="all" />
                  </RadioBar>
                </ControlGroup>
              )}

              <ControlGroup
                help={
                  browsingEntireCatalogue
                    ? "Narrows the installed-app catalogue by the search execution app."
                    : "Suggested searches are already limited to this app. Choose Entire catalogue to filter other apps."
                }
                label="App"
              >
                {browsingEntireCatalogue ? (
                  <Multiselect
                    compact
                    filter
                    onChange={(_event, { values }) =>
                      setSelectedApps(new Set(values.map(String)))
                    }
                    placeholder={`All apps (${apps.length})`}
                    showSelectedValuesFirst="nextOpen"
                    values={Array.from(selectedApps)}
                  >
                    {apps.map((app) => (
                      <Multiselect.Option
                        description={`${appCountByName.get(app) ?? 0} searches`}
                        descriptionPosition="right"
                        key={app}
                        label={app}
                        value={app}
                      />
                    ))}
                  </Multiselect>
                ) : (
                  <StaticContent>This app</StaticContent>
                )}
              </ControlGroup>

              <ControlGroup controlsLayout="stack" label="Visibility">
                <Checkbox
                  checked={includeAddedSearches}
                  onChange={(_event, { checked }) =>
                    setIncludeAddedSearches(checked)
                  }
                >
                  Show added searches
                </Checkbox>
                <Checkbox
                  checked={includeHiddenSearches}
                  onChange={(_event, { checked }) =>
                    setIncludeHiddenSearches(checked)
                  }
                >
                  Show hidden searches
                </Checkbox>
                <Checkbox
                  checked={includeDrilldownSearches}
                  onChange={(_event, { checked }) =>
                    setIncludeDrilldownSearches(checked)
                  }
                >
                  Show drill-down searches
                </Checkbox>
                <Checkbox
                  checked={includeTableSearches}
                  onChange={(_event, { checked }) =>
                    setIncludeTableSearches(checked)
                  }
                >
                  Show table searches
                </Checkbox>
              </ControlGroup>

              {categories.length > 0 && (
                <ControlGroup label="Category">
                  <Select
                    onChange={(_event, { value }) =>
                      setSelectedCategory(String(value))
                    }
                    value={selectedCategory}
                  >
                    <Select.Option
                      label="All categories"
                      value={ALL_ADD_TILE_CATEGORIES}
                    />
                    {categories.map((category) => (
                      <Select.Option
                        key={category}
                        label={category}
                        value={category}
                      />
                    ))}
                  </Select>
                </ControlGroup>
              )}

              {selectedCategory !== ALL_ADD_TILE_CATEGORIES &&
                subCategories.length > 0 && (
                  <ControlGroup label="Subcategory">
                    <Select
                      onChange={(_event, { value }) =>
                        setSelectedSubCategory(String(value))
                      }
                      value={selectedSubCategory}
                    >
                      <Select.Option
                        label={`All subcategories (${subCategories.length})`}
                        value={ALL_ADD_TILE_SUB_CATEGORIES}
                      />
                      {subCategories.map((subCategory) => (
                        <Select.Option
                          key={subCategory}
                          label={subCategory}
                          value={subCategory}
                        />
                      ))}
                    </Select>
                  </ControlGroup>
                )}

              {(allTagsWithCounts.length > 0 || activeTags.size > 0) && (
                <ControlGroup
                  help="Selected tags are combined with AND."
                  label="Tags"
                >
                  <Multiselect
                    compact
                    filter
                    onChange={(_event, { values }) =>
                      setActiveTags(new Set(values.map(String)))
                    }
                    placeholder={`All tags (${allTagsWithCounts.length})`}
                    showSelectedValuesFirst="nextOpen"
                    values={Array.from(activeTags)}
                  >
                    {allTagsWithCounts.map(([tag, count]) => (
                      <Multiselect.Option
                        description={`${count} searches`}
                        descriptionPosition="right"
                        key={tag}
                        label={tag}
                        value={tag}
                      />
                    ))}
                  </Multiselect>
                </ControlGroup>
              )}
            </CollapsiblePanel>
          </div>

          <div id="overview-add-search-results">
            <ScreenReaderContent role="status">
              {availableSearchLabel}
            </ScreenReaderContent>
            {loading && (
              <Layout>
                <WaitSpinner size="medium" screenReaderText={null} />
                <span>Loading searches</span>
              </Layout>
            )}
            {!loading && filteredRecords.length === 0 && (
              <Message type="info">
                {!includeAddedSearches && matchingAddedCount > 0
                  ? `All matching searches are already configured in ${sectionTitle}. Turn on Show added searches to review them.`
                  : "No searches match the current filters."}
              </Message>
            )}
            {!loading && filteredRecords.length > 0 && (
              <CardLayout
                cardWidth="100%"
                gutterSize={Number.parseFloat(theme.spacingMedium)}
              >
                {filteredRecords.map((record) => {
                  const alreadyInSection = searchbaseReferenceSetHasRecord(
                    currentSearchbaseIds,
                    record,
                    currentAppOwner,
                  );
                  const hiddenInSection = isHiddenSearchbaseRecord(record);
                  const locallyAdded = searchbaseReferenceSetHasRecord(
                    locallyAddedSearchbaseIds,
                    record,
                    currentAppOwner,
                  );
                  const workspaceAdded = searchbaseReferenceSetHasRecord(
                    workspaceAddedSearchbaseIds,
                    record,
                    currentAppOwner,
                  );
                  const alreadyAdded =
                    alreadyInSection || locallyAdded || workspaceAdded;
                  const disabled = alreadyAdded && !hiddenInSection;
                  const description =
                    plainTextFromHtml(record.explanation) ??
                    plainTextFromHtml(record.description);
                  const tags = Array.from(
                    new Set(
                      [record.catalogueApp, ...record.tags].filter(Boolean),
                    ),
                  ).slice(0, 3);
                  const isAdding =
                    addingRecordId === searchbaseRecordReference(record);
                  const searchbaseUrl = splunkSearchbaseEditUrl(record.id);
                  let addActionLabel = "Added";
                  if (!alreadyAdded && addDestination === "workspace") {
                    addActionLabel = isAdding
                      ? "Adding for everyone"
                      : "Add for everyone";
                  } else if (!alreadyAdded) {
                    addActionLabel = isAdding ? "Adding for me" : "Add for me";
                  }
                  const action = hiddenInSection ? (
                    <Button
                      aria-label={`Show ${record.searchName} in ${sectionTitle}`}
                      appearance="secondary"
                      icon={<Eye aria-hidden="true" />}
                      label="Show"
                      onClick={() => onUnhide(record)}
                    />
                  ) : locallyAdded ? (
                    <Button
                      aria-label={`Remove ${record.searchName} from ${sectionTitle}`}
                      appearance="destructiveSecondary"
                      icon={<Trash2 aria-hidden="true" />}
                      label="Remove"
                      onClick={() => onRemove(record)}
                    />
                  ) : workspaceAdded && canManageWorkspace ? (
                    <Button
                      aria-label={`Remove default: ${record.searchName} from ${sectionTitle}`}
                      appearance="destructiveSecondary"
                      icon={<Trash2 aria-hidden="true" />}
                      label="Remove default"
                      onClick={(event) => {
                        sharedRemovalReturnFocusRef.current =
                          event.currentTarget;
                        setSharedRemovalError(null);
                        setSharedRemovalRecord(record);
                      }}
                    />
                  ) : (
                    <Button
                      aria-label={
                        alreadyAdded
                          ? `Added: ${record.searchName} in ${sectionTitle}`
                          : `${addActionLabel}: ${record.searchName} to ${sectionTitle}`
                      }
                      aria-busy={isAdding}
                      appearance="standalone"
                      disabled={disabled || isAdding}
                      icon={
                        isAdding ? (
                          <WaitSpinner screenReaderText={null} />
                        ) : (
                          <Plus aria-hidden="true" />
                        )
                      }
                      label={addActionLabel}
                      onClick={() => void handleAdd(record)}
                    />
                  );
                  return (
                    <Card key={searchbaseRecordReference(record)} tag="article">
                      <Card.Header
                        actions={() => (
                          <Layout>
                            <Button
                              aria-label={`View in Searchbase: ${record.searchName}`}
                              appearance="standalone"
                              label="View in Searchbase"
                              openInNewContext
                              to={searchbaseUrl}
                            />
                            {action}
                          </Layout>
                        )}
                        subtitle={
                          [record.category, record.subCategory]
                            .filter(Boolean)
                            .join(" / ") || record.id
                        }
                        truncateTitle={false}
                        title={
                          <>
                            {record.searchName}
                            {hiddenInSection && (
                              <>
                                {" "}
                                <Badge label="Hidden in section" />
                              </>
                            )}
                            {!hiddenInSection && workspaceAdded && (
                              <>
                                {" "}
                                <Badge label="Added for everyone" />
                              </>
                            )}
                            {!hiddenInSection &&
                              alreadyAdded &&
                              !workspaceAdded && (
                                <>
                                  {" "}
                                  <Badge label="Added" />
                                </>
                              )}
                            {record.searchHidden && (
                              <>
                                {" "}
                                <Badge label="Hidden search" />
                              </>
                            )}
                          </>
                        }
                      />
                      {(description || tags.length > 0) && (
                        <Card.Body>
                          {description && <p>{description}</p>}
                          {tags.length > 0 && (
                            <Layout>
                              {tags.map((tag) => (
                                <Chip key={tag}>{tag}</Chip>
                              ))}
                            </Layout>
                          )}
                        </Card.Body>
                      )}
                    </Card>
                  );
                })}
              </CardLayout>
            )}
          </div>
        </Drawer.Body>
      </Drawer>
      <div aria-live="polite" role="status">
        <ScreenReaderContent>{sharedRemovalAnnouncement}</ScreenReaderContent>
      </div>
      <Modal
        onRequestClose={() => {
          if (!sharedRemovalSaving) setSharedRemovalRecord(null);
        }}
        open={sharedRemovalRecord !== null}
        returnFocus={() => {
          const previousAction = sharedRemovalReturnFocusRef.current;
          if (previousAction?.isConnected) previousAction.focus();
          else searchInputRef.current?.focus();
        }}
        style={{ maxWidth: "calc(100vw - 32px)", width: "440px" }}
      >
        <Modal.Header title="Remove tile for everyone?" />
        <Modal.Body>
          <p>
            {sharedRemovalRecord?.searchName} will no longer appear for everyone
            who views this workspace. People who added it for themselves will
            keep it.
          </p>
          {sharedRemovalError && (
            <div role="alert">
              <Message type="error">{sharedRemovalError}</Message>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            appearance="secondary"
            label="Cancel"
            onClick={() => setSharedRemovalRecord(null)}
          />
          <Button
            appearance="destructive"
            disabled={sharedRemovalSaving}
            icon={
              sharedRemovalSaving ? (
                <WaitSpinner screenReaderText={null} />
              ) : (
                <Trash2 aria-hidden="true" />
              )
            }
            label={sharedRemovalSaving ? "Removing" : "Remove tile"}
            onClick={() => void handleConfirmSharedRemoval()}
          />
        </Modal.Footer>
      </Modal>
    </>
  );
};

// =============================================================================
// Tiny KPI card under the map
// =============================================================================

const OverviewMetricsColumn = styled.div`
  @media (width >= 1120px) {
    &[data-map-position="right"] {
      /* In split view, the map and its KPI cards set the row height. */
      contain: size;
    }
  }
`;

const SplitSeparator = styled.hr<{ $horizontal: boolean }>`
  position: relative;
  flex-shrink: 0;
  align-self: stretch;
  width: ${({ $horizontal }) => ($horizontal ? "100%" : "1px")};
  height: ${({ $horizontal }) => ($horizontal ? "1px" : "auto")};
  margin: 0;
  border: 0;
  background-color: ${variables.borderColor};
  cursor: ${({ $horizontal }) => ($horizontal ? "row-resize" : "col-resize")};
  margin-left: ${({ $horizontal }) =>
    $horizontal ? "0" : variables.spacingMedium};

  &::before {
    content: "";
    position: absolute;
    top: ${({ $horizontal }) => ($horizontal ? "50%" : "0")};
    left: ${({ $horizontal }) => ($horizontal ? "0" : "50%")};
    width: ${({ $horizontal }) =>
      $horizontal ? "100%" : variables.spacingXLarge};
    height: ${({ $horizontal }) =>
      $horizontal ? variables.spacingXLarge : "100%"};
    transform: ${({ $horizontal }) =>
      $horizontal ? "translateY(-50%)" : "translateX(-50%)"};
  }

  &:focus-visible {
    box-shadow: ${variables.focusShadow};
  }
`;

const MapViewport = styled.div`
  flex: 1 0 400px;
  min-height: 400px;
`;

interface KpiCardProps {
  label: string;
  value: string;
  status: MetricStatus;
  onOpenInSearch?: () => void;
  searchbaseId?: string;
  onConfigure?: (returnFocus?: HTMLElement | null) => void;
}

const formatMapKpiValue = (value: string): string => {
  const match = value.trim().match(/^(-?\d[\d,]*)(?:\.(\d+))?(\s*[^\d\s].*)?$/);
  if (!match) return value;

  const [, whole, fraction, suffix = ""] = match;
  if (!fraction) return `${whole}${suffix}`;

  const numericValue = Number(`${whole.replace(/,/g, "")}.${fraction}`);
  const roundedValue = Math.round((numericValue + Number.EPSILON) * 10) / 10;
  return `${roundedValue.toLocaleString("en-US", {
    maximumFractionDigits: 1,
  })}${suffix}`;
};

const MAP_KPI_STATUS_TOKENS = {
  healthy: variables.severityColorNormal,
  warning: variables.severityColorWarning,
  critical: variables.severityColorCritical,
  unknown: variables.severityColorUnknown,
};

const MAP_KPI_STATUS_LABELS: Record<MetricStatus, string> = {
  healthy: "Healthy",
  warning: "Warning",
  critical: "Critical",
  unknown: "Unknown",
};

const MapKpiStatusBadge = styled(Badge)<{ $status: MetricStatus }>`
  padding: ${variables.spacingXSmall} ${variables.spacingSmall};
  border: 1px solid ${({ $status }) => MAP_KPI_STATUS_TOKENS[$status]};
  font-family: ${variables.fontFamily};
  font-size: ${variables.fontSizeSmall};
  font-weight: ${variables.fontWeightSemiBold};
  line-height: ${variables.lineHeightSingle};
  white-space: nowrap;
`;

const MapKpiContent = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  gap: ${variables.spacingSmall};
  text-align: center;
`;

const MapKpiValue = styled.p<{ $status: MetricStatus }>`
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: ${({ $status }) => MAP_KPI_STATUS_TOKENS[$status]};
  font-family: ${variables.fontFamily};
  font-size: 1.875rem;
  font-weight: ${variables.fontWeightBold};
  line-height: ${variables.lineHeightSingle};
  text-overflow: ellipsis;
  white-space: nowrap;
`;

// =============================================================================
// Regional view toggle (MAP / TABLE)
// =============================================================================

type RegionalView = "map" | "table";

interface RegionalViewToggleProps {
  value: RegionalView;
  onChange: (next: RegionalView) => void;
}

const REGIONAL_VIEW_OPTIONS = [
  { value: "map", label: "Map" },
  { value: "table", label: "Table" },
] as const;

const RegionalViewToggle: React.FC<RegionalViewToggleProps> = ({
  value,
  onChange,
}) => (
  <OneCdRadioBar
    ariaLabel="Topology view"
    options={REGIONAL_VIEW_OPTIONS}
    value={value}
    onChange={onChange}
  />
);

// =============================================================================
// Metric detail-table modal
// =============================================================================

interface MetricDetailTableModalProps {
  config: MetricDetailTableConfig;
  onClose: () => void;
  range: TimeRange;
  refreshToken: number;
}

type MetricDetailSortDirection = "asc" | "desc";

interface MetricDetailSortState {
  field: string;
  direction: MetricDetailSortDirection;
}

type MetricDetailTableStateKind = "loading" | "empty" | "error";

interface MetricDetailTableStateRowProps {
  columnCount: number;
  kind: MetricDetailTableStateKind;
  message: string;
  title: string;
}

const MetricDetailTableStateRow: React.FC<MetricDetailTableStateRowProps> = ({
  columnCount,
  kind,
  message,
  title,
}) => {
  const Icon =
    kind === "loading" ? RefreshCw : kind === "error" ? AlertCircle : Search;
  const iconClasses =
    kind === "error"
      ? "sui-border-negative sui-bg-notification-negative sui-color-active"
      : "sui-border-info sui-bg-notification-info sui-color-active";

  return (
    <tr>
      <td colSpan={columnCount} className="px-5 py-14 text-center">
        <div
          className="mx-auto flex max-w-md flex-col items-center gap-2"
          role={kind === "error" ? "alert" : "status"}
          aria-live={kind === "error" ? "assertive" : "polite"}
        >
          <span
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-full border",
              iconClasses,
            )}
          >
            <Icon
              className={cn("h-4 w-4", kind === "loading" && "animate-spin")}
              aria-hidden="true"
            />
          </span>
          <strong className="text-sm font-semibold sui-color-active">
            {title}
          </strong>
          <span className="text-xs leading-5 sui-color-default">{message}</span>
        </div>
      </td>
    </tr>
  );
};

const readRowString = (
  row: Record<string, unknown>,
  field: string,
  fallback = "",
): string => {
  const raw = row[field];
  if (raw === null || raw === undefined) return fallback;
  if (Array.isArray(raw)) return raw.map(String).join(", ");
  const text = String(raw).trim();
  if (text.toLowerCase() === "null") return fallback;
  return text || fallback;
};

const EMPTY_SORT_VALUES = new Set([
  "",
  "-",
  "n/a",
  "na",
  "none",
  "null",
  "undefined",
  "no current sample",
]);

const DURATION_UNIT_TO_MS: Record<string, number> = {
  ms: 1,
  millisecond: 1,
  milliseconds: 1,
  s: 1000,
  sec: 1000,
  secs: 1000,
  second: 1000,
  seconds: 1000,
  m: 60_000,
  min: 60_000,
  mins: 60_000,
  minute: 60_000,
  minutes: 60_000,
  h: 3_600_000,
  hr: 3_600_000,
  hrs: 3_600_000,
  hour: 3_600_000,
  hours: 3_600_000,
  d: 86_400_000,
  day: 86_400_000,
  days: 86_400_000,
};

const isEmptySortValue = (value: string): boolean =>
  EMPTY_SORT_VALUES.has(value.trim().toLowerCase());

const parseSortableDetailNumber = (value: string): number | null => {
  const normalized = value.trim().toLowerCase().replace(/,/g, "");
  if (!normalized || isEmptySortValue(normalized)) return null;

  if (/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)\s*%?$/.test(normalized)) {
    return Number.parseFloat(normalized);
  }

  const durationMatch = normalized.match(
    /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*([a-z]+)(?:\s+ago)?$/,
  );
  if (durationMatch) {
    const unit = durationMatch[2];
    const multiplier = DURATION_UNIT_TO_MS[unit];
    if (multiplier !== undefined) {
      return Number.parseFloat(durationMatch[1]) * multiplier;
    }
  }

  return null;
};

const compareDetailCellValues = (
  a: string,
  b: string,
  direction: MetricDetailSortDirection,
): number => {
  const aEmpty = isEmptySortValue(a);
  const bEmpty = isEmptySortValue(b);
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  const aNumber = parseSortableDetailNumber(a);
  const bNumber = parseSortableDetailNumber(b);
  const base =
    aNumber !== null && bNumber !== null
      ? aNumber - bNumber
      : a.localeCompare(b, undefined, {
          numeric: true,
          sensitivity: "base",
        });
  return direction === "asc" ? base : -base;
};

const MetricDetailTableModal: React.FC<MetricDetailTableModalProps> = ({
  config,
  onClose,
  range,
  refreshToken,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeConfig = config.targets[activeIndex] ?? config.targets[0];
  const targetKey = config.targets
    .map((target) => target.searchbaseId)
    .join("\u0000");
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [tableColumns, setTableColumns] = useState<MetricDetailTableColumn[]>(
    activeConfig.columns,
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [sortState, setSortState] = useState<MetricDetailSortState | null>(
    null,
  );
  const activeIsTable = isTableViz(activeConfig.defaultViz);
  const activeDefinition = useMemo(
    () =>
      activeIsTable
        ? null
        : buildWorkspaceDrilldownDefinition(
            {
              searchName: activeConfig.metadata.title,
              search: activeConfig.spl,
              defaultViz: activeConfig.defaultViz,
              vizOptions: activeConfig.vizOptions,
              dispatchContext: activeConfig.dispatchContext,
            },
            range,
          ),
    [activeConfig, activeIsTable, range],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [targetKey]);

  useEffect(() => {
    if (activeIndex >= config.targets.length) setActiveIndex(0);
  }, [activeIndex, config.targets.length]);

  useEffect(() => {
    if (!activeIsTable) {
      setLoading(false);
      setRows([]);
      setTableColumns(activeConfig.columns);
      setErrorMessage("");
      setSortState(null);
      return undefined;
    }

    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setRows([]);
    setTableColumns(activeConfig.columns);
    setErrorMessage("");
    setSortState(null);

    runSearch({
      spl: activeConfig.spl,
      earliestTime: range.earliest,
      latestTime: range.latest,
      tag: activeConfig.tag,
      appContext: activeConfig.dispatchContext,
      count: 1000,
      signal: controller.signal,
    })
      .then((res) => {
        if (cancelled) return;
        const rawRows = (res?.results ?? []) as Array<Record<string, unknown>>;
        const columns =
          activeConfig.columns.length > 0
            ? activeConfig.columns
            : inferDetailTableColumns(rawRows);
        const nextRows = rawRows.map((row) => {
          const detailRow: Record<string, string> = {};
          columns.forEach((column) => {
            detailRow[column.field] = readRowString(
              row,
              column.field,
              column.fallback ?? "",
            );
          });
          return detailRow;
        });
        setTableColumns(columns);
        setRows(nextRows);
      })
      .catch((error: unknown) => {
        if (
          cancelled ||
          (error instanceof Error && error.name === "AbortError")
        ) {
          return;
        }
        if (!cancelled) {
          setRows([]);
          setTableColumns(activeConfig.columns);
          setErrorMessage(activeConfig.errorMessage);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeConfig, activeIsTable, range.earliest, range.latest, refreshToken]);

  const availableStatus = activeConfig.availableStatus ?? "Available";
  const unavailableStatus = activeConfig.unavailableStatus ?? "Unavailable";
  const titleId = `${activeConfig.tag}-title`;
  const statusField = activeConfig.statusField;
  const displayColumns =
    tableColumns.length > 0 ? tableColumns : activeConfig.columns;
  const columnCount = Math.max(displayColumns.length, 1);
  const sortedRows = useMemo(() => {
    if (!sortState) return rows;
    const columnExists = displayColumns.some(
      (column) => column.field === sortState.field,
    );
    if (!columnExists) return rows;
    return rows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        const result = compareDetailCellValues(
          a.row[sortState.field] ?? "",
          b.row[sortState.field] ?? "",
          sortState.direction,
        );
        return result || a.index - b.index;
      })
      .map(({ row }) => row);
  }, [displayColumns, rows, sortState]);
  const handleSortColumn = (field: string) => {
    setSortState((current) => {
      if (current?.field === field) {
        return {
          field,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }
      return { field, direction: "asc" };
    });
  };
  const availableCount = statusField
    ? rows.filter((row) => row[statusField] === availableStatus).length
    : 0;
  const unavailableCount = statusField ? rows.length - availableCount : 0;
  const searchUrl = splunkSearchAppUrl(
    activeConfig.spl,
    range,
    activeConfig.dispatchContext,
  );
  const searchbaseUrl = splunkSearchbaseEditUrl(activeConfig.searchbaseId);
  const activeClassification = [
    activeConfig.metadata.category,
    activeConfig.metadata.subCategory,
  ].filter(Boolean);
  const resultTitleId = `${activeConfig.tag}-results-title`;
  const showTarget = (nextIndex: number) => {
    const boundedIndex = Math.max(
      0,
      Math.min(config.targets.length - 1, nextIndex),
    );
    const nextConfig = config.targets[boundedIndex];
    if (!nextConfig || boundedIndex === activeIndex) return;
    // Clear the current result in the same render as the navigation change so
    // rows from the previous search never flash under the next target's title.
    setRows([]);
    setTableColumns(nextConfig.columns);
    setErrorMessage("");
    setSortState(null);
    setLoading(true);
    setActiveIndex(boundedIndex);
  };

  return (
    <WorkspaceModalShell
      variant="detail"
      title={config.title}
      subtitle={activeConfig.subtitle(range)}
      titleId={titleId}
      onClose={onClose}
      openInSearchHref={searchUrl}
      openInSearchbaseHref={searchbaseUrl}
      wide={!activeIsTable || displayColumns.length > 5}
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden sui-bg-section"
      headerMeta={
        activeIsTable && statusField ? (
          <>
            <span className="inline-flex items-center gap-1 rounded-full sui-bg-notification-positive px-2 py-1 text-xs font-semibold sui-color-active">
              <CheckCircle2 className="h-3 w-3" />
              {availableCount} available
            </span>
            <span className="inline-flex items-center gap-1 rounded-full sui-bg-notification-negative px-2 py-1 text-xs font-semibold sui-color-active">
              <AlertCircle className="h-3 w-3" />
              {unavailableCount} unavailable
            </span>
          </>
        ) : undefined
      }
    >
      <div
        className="flex shrink-0 items-center border-b sui-border-weak sui-bg-page px-4 py-2.5"
        data-detail-search-summary="true"
      >
        <div className="min-w-0 flex-1">
          <div
            id={resultTitleId}
            className="truncate text-sm font-bold sui-color-default"
          >
            {activeConfig.metadata.title}
          </div>
          {activeClassification.length > 0 && (
            <div className="mt-0.5  font-bold  tracking-[0.12em] sui-color-default">
              {activeClassification.join(" • ")}
            </div>
          )}
        </div>
        {config.targets.length > 1 && (
          <div className="ml-4 flex-shrink-0">
            <Paginator.Compact
              aria-label="Drill-down search navigation"
              current={activeIndex + 1}
              onChange={(_event, { page }) => {
                if (page !== undefined) showTarget(page - 1);
              }}
              renderLabel={({ current, totalPages }) =>
                `${current ?? 1} / ${totalPages ?? config.targets.length}`
              }
              totalPages={config.targets.length}
            />
            <ScreenReaderContent aria-live="polite">
              Showing {activeConfig.metadata.title}, search {activeIndex + 1} of{" "}
              {config.targets.length}
            </ScreenReaderContent>
          </div>
        )}
      </div>
      <div
        className="min-h-[154px] max-h-[min(46vh,520px)] shrink overflow-auto overscroll-contain"
        data-detail-results-region="content-aware"
      >
        {activeIsTable ? (
          <table
            aria-labelledby={resultTitleId}
            className="w-full min-w-[860px] sui-bg-transparent text-sm"
          >
            <thead className="sticky top-0 z-10 border-b sui-border-weak sui-bg-page backdrop-blur-xl">
              <tr className="text-left text-xs font-bold sui-color-default">
                {displayColumns.map((column, index) => {
                  const isSorted = sortState?.field === column.field;
                  const SortIcon = isSorted
                    ? sortState.direction === "asc"
                      ? ArrowUp
                      : ArrowDown
                    : ArrowUpDown;
                  return (
                    <th
                      key={column.field}
                      scope="col"
                      aria-sort={
                        isSorted
                          ? sortState.direction === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      className={cn(
                        index === 0 ? "px-5" : "px-4",
                        "py-3",
                        column.align === "right" && "text-right",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => handleSortColumn(column.field)}
                        title={`Sort by ${column.label}`}
                        className={cn(
                          "group inline-flex w-full items-center gap-1.5 rounded px-1 py-0.5 -mx-1 text-left transition-colors  sui-hover-color-info focus:outline-none focus:ring-2 sui-focus-ring",
                          column.align === "right"
                            ? "justify-end"
                            : "justify-start",
                          isSorted && "sui-color-info",
                        )}
                      >
                        <span>{column.label}</span>
                        <SortIcon
                          className={cn(
                            "h-3 w-3 flex-shrink-0",
                            isSorted
                              ? "opacity-100"
                              : "opacity-35 group-hover:opacity-80",
                          )}
                          aria-hidden="true"
                        />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y sui-divide-weak">
              {loading ? (
                <MetricDetailTableStateRow
                  columnCount={columnCount}
                  kind="loading"
                  title="Loading details"
                  message={`Running ${activeConfig.metadata.title.toLowerCase()} for the selected time range.`}
                />
              ) : errorMessage ? (
                <MetricDetailTableStateRow
                  columnCount={columnCount}
                  kind="error"
                  title="Details unavailable"
                  message={`${errorMessage} Open the query in Search to inspect the failure.`}
                />
              ) : rows.length === 0 ? (
                <MetricDetailTableStateRow
                  columnCount={columnCount}
                  kind="empty"
                  title="No results in this time range"
                  message={`${activeConfig.emptyMessage} Try a wider range or open the query in Search.`}
                />
              ) : (
                sortedRows.map((row, rowIndex) => {
                  const rowStatus = statusField ? row[statusField] : "";
                  const rowIsAvailable = rowStatus === availableStatus;
                  const rowKey =
                    (activeConfig.rowKeyField &&
                      row[activeConfig.rowKeyField]) ||
                    displayColumns
                      .map((column) => row[column.field])
                      .join("|") ||
                    "detail-row";
                  return (
                    <tr
                      key={`${rowKey}-${rowIndex}`}
                      className="sui-bg-section"
                    >
                      {displayColumns.map((column, index) => {
                        const value = row[column.field];
                        const isStatusColumn = column.kind === "status";
                        const statusIsAvailable = value === availableStatus;
                        const statusIsUnavailable = value === unavailableStatus;
                        return (
                          <td
                            key={column.field}
                            className={cn(
                              index === 0
                                ? "px-5 font-medium sui-color-default"
                                : "px-4 sui-color-default",
                              "py-3",
                              column.align === "right" &&
                                "text-right tabular-nums",
                              column.truncate && "max-w-xs truncate",
                              column.kind === "metric" &&
                                statusField &&
                                (rowIsAvailable
                                  ? "font-medium  sui-color-positive"
                                  : "font-medium  sui-color-negative"),
                            )}
                          >
                            {isStatusColumn ? (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold",
                                  statusIsAvailable
                                    ? "sui-bg-notification-positive sui-color-active"
                                    : statusIsUnavailable
                                      ? "sui-bg-notification-negative sui-color-active"
                                      : "sui-bg-popup sui-color-active",
                                )}
                              >
                                {statusIsAvailable ? (
                                  <CheckCircle2 className="w-3 h-3" />
                                ) : (
                                  <AlertCircle className="w-3 h-3" />
                                )}
                                {value}
                              </span>
                            ) : (
                              value
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        ) : (
          activeDefinition && (
            <div
              className="min-h-[420px] w-full sui-bg-page"
              aria-labelledby={resultTitleId}
              role="region"
              data-detail-visualization={
                activeConfig.defaultViz ?? "splunk.table"
              }
            >
              <DashboardContextProvider
                key={`${activeConfig.searchbaseId}:${range.earliest}:${range.latest}:${refreshToken}`}
                preset={EnterpriseViewOnlyPreset}
                initialDefinition={
                  activeDefinition as unknown as React.ComponentProps<
                    typeof DashboardContextProvider
                  >["initialDefinition"]
                }
                initialMode="view"
              >
                <DashboardCore width="100%" height="420px" />
              </DashboardContextProvider>
            </div>
          )
        )}
      </div>
      <SearchbaseDrilldownGuidance
        metadata={activeConfig.metadata}
        appearance="workspace"
      />
    </WorkspaceModalShell>
  );
};

// =============================================================================
// Section title editor
// =============================================================================

interface SectionTitlesEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  values: CustomerTopologySectionTitles;
  defaults: CustomerTopologySectionTitles;
  visibleSections: SectionId[];
  availableSections: readonly SectionId[];
  maxSections: number;
  onSave: (next: CustomerTopologySectionTitles) => Promise<void>;
  onResetToDefaults: () => Promise<void>;
  onLayoutChange: (next: SectionId[]) => void;
  onResetLayout: () => void;
}

const SectionTitlesEditorModal: React.FC<SectionTitlesEditorModalProps> = ({
  isOpen,
  onClose,
  values,
  defaults,
  visibleSections,
  availableSections,
  maxSections,
  onSave,
  onResetToDefaults,
  onLayoutChange,
  onResetLayout,
}) => {
  const [draft, setDraft] = useState<CustomerTopologySectionTitles>(values);
  const [layoutDraft, setLayoutDraft] = useState<SectionId[]>(visibleSections);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setDraft(values);
    setLayoutDraft(visibleSections);
    setErrorMessage("");
    setIsSaving(false);
  }, [isOpen, values, visibleSections]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, isSaving, onClose]);

  if (!isOpen) return null;

  const setTitle = (key: SectionId, value: string) => {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const activeSet = new Set(layoutDraft);
  const hiddenSections = availableSections.filter(
    (section) => !activeSet.has(section),
  );
  const editorSections = [
    ...layoutDraft.filter((section) => availableSections.includes(section)),
    ...hiddenSections,
  ];
  const canAddSection =
    layoutDraft.length < maxSections && hiddenSections.length > 0;

  const addSection = () => {
    if (!canAddSection) return;
    setLayoutDraft((current) => {
      const next = availableSections.find(
        (section) => !current.includes(section),
      );
      if (!next) return current;
      return [...current, next].slice(0, maxSections);
    });
  };

  const showSection = (section: SectionId) => {
    setLayoutDraft((current) => {
      if (current.includes(section) || current.length >= maxSections)
        return current;
      return [...current, section];
    });
  };

  const hideSection = (section: SectionId) => {
    setLayoutDraft((current) => {
      if (!current.includes(section) || current.length <= 1) return current;
      return current.filter((candidate) => candidate !== section);
    });
  };

  const save = async () => {
    setIsSaving(true);
    setErrorMessage("");
    try {
      const next: CustomerTopologySectionTitles = { ...defaults, ...draft };
      for (const section of availableSections) {
        next[section] = draft[section]?.trim() || defaults[section];
      }
      await onSave(next);
      onLayoutChange(layoutDraft);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setIsSaving(false);
    }
  };

  const reset = async () => {
    setIsSaving(true);
    setErrorMessage("");
    try {
      await onResetToDefaults();
      onResetLayout();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setIsSaving(false);
    }
  };

  const inputClass =
    "w-full px-2 py-1.5 text-sm  sui-bg-popup border " +
    "sui-border-default rounded sui-color-active " +
    "sui-color-active sui-placeholder-muted " +
    "focus:outline-none focus:ring-1 sui-focus-ring";
  const labelClass =
    "block text-xs font-bold  sui-color-default " + " tracking-wider mb-1";

  return (
    <WorkspaceModalShell
      isOpen={isOpen}
      variant="form"
      title="Edit sections"
      subtitle={`${layoutDraft.length} of ${maxSections} visible`}
      onClose={onClose}
      closeOnBackdrop={false}
      renderInDocumentBody
      contentClassName="overflow-y-auto"
    >
      <div className="space-y-5 px-5 py-5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold sui-color-default">
            {layoutDraft.length} of {maxSections} visible
          </div>
          <button
            type="button"
            onClick={addSection}
            disabled={!canAddSection || isSaving}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded",
              "border sui-border-info sui-bg-section text-sm font-bold",
              "sui-color-info sui-hover-bg-info",
              (!canAddSection || isSaving) && "cursor-not-allowed opacity-50",
            )}
          >
            <Plus className="w-3.5 h-3.5" />
            Add section
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {editorSections.map((section) => {
            const isVisible = activeSet.has(section);
            const visibleIndex = layoutDraft.indexOf(section);
            const canShow = !isVisible && layoutDraft.length < maxSections;
            const canHide = isVisible && layoutDraft.length > 1;
            const sectionKeyLabel = section
              .replace(/_/g, " ")
              .replace(/\b\w/g, (letter) => letter.toUpperCase());
            return (
              <div
                key={section}
                className={cn(
                  "rounded-lg border p-3 transition-colors",
                  isVisible
                    ? "sui-border-info sui-bg-section"
                    : "sui-border-weak sui-bg-page",
                )}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label
                    htmlFor={`section-title-${section}`}
                    className={cn(labelClass, "mb-0")}
                  >
                    {isVisible
                      ? `Section ${visibleIndex + 1}`
                      : "Hidden section"}
                    <span className="ml-2 text-xs font-black  sui-color-muted">
                      {sectionKeyLabel}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      isVisible ? hideSection(section) : showSection(section)
                    }
                    disabled={isSaving || (isVisible ? !canHide : !canShow)}
                    title={isVisible ? "Hide section" : "Show section"}
                    aria-label={
                      isVisible
                        ? `Hide ${draft[section] || defaults[section]}`
                        : `Show ${draft[section] || defaults[section]}`
                    }
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded border px-2",
                      "text-sm font-bold transition-colors",
                      isVisible
                        ? "sui-border-default sui-bg-section sui-color-default sui-hover-bg-overlay sui-hover-color-active"
                        : "sui-border-info sui-bg-section sui-color-active sui-hover-bg-notification-info",
                      (isSaving || (isVisible ? !canHide : !canShow)) &&
                        "cursor-not-allowed opacity-50",
                    )}
                  >
                    {isVisible ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                    {isVisible ? "Hide" : "Show"}
                  </button>
                </div>
                <input
                  id={`section-title-${section}`}
                  type="text"
                  value={draft[section]}
                  onChange={(e) => setTitle(section, e.target.value)}
                  placeholder={defaults[section]}
                  maxLength={48}
                  className={inputClass}
                />
              </div>
            );
          })}
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded border px-3 py-2 text-sm font-semibold sui-border-negative sui-bg-notification-negative sui-color-active"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span className="min-w-0 break-words">{errorMessage}</span>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t sui-border-weak sui-bg-section px-5 py-4">
        <button
          type="button"
          onClick={reset}
          disabled={isSaving}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded border",
            "sui-border-default text-sm font-bold",
            "sui-color-default sui-color-active sui-hover-bg-page",
            "sui-hover-bg-overlay transition-colors",
            isSaving && "cursor-not-allowed opacity-50",
          )}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className={cn(
              "px-3 py-1.5 rounded border sui-border-default",
              "sui-border-default text-sm font-bold sui-color-default",
              "sui-color-active sui-hover-bg-page",
              "sui-hover-bg-overlay transition-colors",
              isSaving && "cursor-not-allowed opacity-50",
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={isSaving}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5",
              "rounded text-sm font-bold scd-action-primary",
              "transition-colors",
              isSaving && "cursor-not-allowed opacity-60",
            )}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Save
          </button>
        </div>
      </div>
    </WorkspaceModalShell>
  );
};

// =============================================================================
// Branding editor (header pencil → "Edit branding" modal)
// =============================================================================

interface BrandingEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  override: BrandingOverride;
  /** Placeholder text shown in the title input when no override is set.
   * Falls back through the configured workspace title/label → hardcoded
   * fallback, matching the precedence rules in the live header. */
  titlePlaceholder: string;
  /** Placeholder text for the subtitle input. Always the
   * out-of-the-box default ("Splunk Secure Networking Essentials"). */
  subtitlePlaceholder: string;
  /** Image src to display in the "current logo" preview when no
   * override logo is set. Lets the user see what they're replacing. */
  logoFallbackSrc: string;
  onSave: (next: BrandingOverride) => boolean | Promise<boolean>;
  onResetToDefaults: () => void;
}

/**
 * Centered modal for editing the shared workspace header (title,
 * subtitle, logo). Title and subtitle are plain text inputs; the logo
 * is a file upload encoded to a `data:` URI and saved on the workspace
 * stanza so every viewer sees the same branding.
 *
 * Behaviour notes:
 *  - "Save" persists whatever's in the form fields. Empty strings
 *    fall back to the workspace label and packaged subtitle.
 *    Returning `false` from `onSave` (e.g. logo too big) keeps the
 *    modal open with an inline error.
 *  - "Reset to defaults" restores packaged header fields and closes
 *    the modal.
 *  - "Cancel" / Esc / backdrop click discards local form changes.
 *  - The file input rejects anything outside the accepted MIME
 *    list, and the FileReader path enforces a 256 KiB cap on the
 *    encoded data URI (~190 KiB binary).
 */
const BrandingEditorModal: React.FC<BrandingEditorModalProps> = ({
  isOpen,
  onClose,
  override,
  titlePlaceholder,
  subtitlePlaceholder,
  logoFallbackSrc,
  onSave,
  onResetToDefaults,
}) => {
  // Form state — initialised from the persisted override every time
  // the modal opens so reopening after a Cancel doesn't show stale
  // values. The `key` is a `useEffect` re-init pattern (sync external
  // → internal) rather than a `key={isOpen}` remount, so we keep a
  // single instance and avoid reinitialising the file input.
  const [titleField, setTitleField] = useState<string>(override.title ?? "");
  const [subtitleField, setSubtitleField] = useState<string>(
    override.subtitle ?? "",
  );
  const [logoDataUri, setLogoDataUri] = useState<string | undefined>(
    override.logoDataUri,
  );
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Re-sync the form when the modal is (re)opened — picks up any
  // override mutations from another tab while the modal was closed,
  // and discards prior unsaved typing if the user re-opens.
  useEffect(() => {
    if (!isOpen) return;
    setTitleField(override.title ?? "");
    setSubtitleField(override.subtitle ?? "");
    setLogoDataUri(override.logoDataUri);
    setErrorMessage("");
  }, [isOpen, override]);

  // Esc-to-close. Listen on the window because focus moves around as
  // the user tabs through the form fields.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage("");
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUri = await readImageAsDataUri(file);
      if (dataUri.length > BRANDING_LOGO_DATA_URI_MAX_BYTES) {
        const kb = Math.round(BRANDING_LOGO_DATA_URI_MAX_BYTES / 1024);
        setErrorMessage(
          `Logo too large after encoding (${Math.round(
            dataUri.length / 1024,
          )} KB). Maximum allowed is ${kb} KB. Please upload a smaller image.`,
        );
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setLogoDataUri(dataUri);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Failed to read image. Please pick a different file.",
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleClearLogo = () => {
    setLogoDataUri(undefined);
    setErrorMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async () => {
    if (isSaving) return;
    const next: BrandingOverride = {
      title: titleField.trim() || undefined,
      subtitle: subtitleField.trim() || undefined,
      logoDataUri,
    };
    setIsSaving(true);
    try {
      const ok = await onSave(next);
      if (!ok) {
        setErrorMessage(
          "Could not save branding (logo may exceed the size limit). Please try a smaller image.",
        );
        return;
      }
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const previewLogoSrc =
    normalizeSharedImageSource(logoDataUri) ||
    normalizeSharedImageSource(logoFallbackSrc);
  const acceptList = BRANDING_ACCEPTED_LOGO_MIME_TYPES.join(",");

  return (
    <WorkspaceModalShell
      isOpen={isOpen}
      variant="form"
      title="Edit branding"
      subtitle="Customize this workspace header"
      onClose={onClose}
      closeOnBackdrop={false}
      renderInDocumentBody
      contentClassName="overflow-y-auto"
    >
      <div className="space-y-5 px-5 py-5">
        {/* Title */}
        <div>
          <label
            htmlFor="branding-title-input"
            className="mb-1.5 block text-sm font-bold sui-color-default"
          >
            Title
          </label>
          <input
            id="branding-title-input"
            type="text"
            value={titleField}
            onChange={(e) => setTitleField(e.target.value)}
            placeholder={titlePlaceholder}
            maxLength={120}
            className="w-full px-2 py-1.5 text-sm  sui-bg-popup border  sui-border-default rounded  sui-color-active sui-placeholder-muted focus:outline-none focus:ring-1 sui-focus-ring"
          />
          <p className="mt-1.5 text-sm leading-5 sui-color-muted">
            Leave blank to use the title configured for this workspace.
          </p>
        </div>

        {/* Subtitle */}
        <div>
          <label
            htmlFor="branding-subtitle-input"
            className="mb-1.5 block text-sm font-bold sui-color-default"
          >
            Subtitle
          </label>
          <input
            id="branding-subtitle-input"
            type="text"
            value={subtitleField}
            onChange={(e) => setSubtitleField(e.target.value)}
            placeholder={subtitlePlaceholder}
            maxLength={120}
            className="w-full px-2 py-1.5 text-sm  sui-bg-popup border  sui-border-default rounded  sui-color-active sui-placeholder-muted focus:outline-none focus:ring-1 sui-focus-ring"
          />
          <p className="mt-1.5 text-sm leading-5 sui-color-muted">
            Leave blank for the default (&ldquo;{subtitlePlaceholder}&rdquo;).
          </p>
        </div>

        {/* Logo */}
        <div>
          <span className="mb-1.5 block text-sm font-bold sui-color-default">
            Logo
          </span>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 sui-bg-notification-info rounded-lg flex items-center justify-center sui-color-active overflow-hidden p-1 flex-shrink-0">
              {previewLogoSrc ? (
                <img
                  src={previewLogoSrc}
                  alt="Logo preview"
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-center text-xs font-bold leading-tight">
                  No logo
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex min-h-9 items-center gap-1.5 rounded border sui-border-info sui-bg-section px-3 text-sm font-bold sui-color-info transition-colors sui-hover-bg-info"
              >
                <Upload className="w-3 h-3" />
                {logoDataUri ? "Replace logo" : "Upload logo"}
              </button>
              {logoDataUri ? (
                <button
                  type="button"
                  onClick={handleClearLogo}
                  className="text-sm sui-color-default underline sui-hover-color-active"
                >
                  Clear (use default)
                </button>
              ) : null}
              <input
                ref={fileInputRef}
                type="file"
                accept={acceptList}
                onChange={handleLogoUpload}
                className="hidden"
              />
            </div>
          </div>
          <p className="mt-1.5 text-sm leading-5 sui-color-muted">
            PNG, SVG, JPEG, WebP, or GIF. Max{" "}
            {Math.round(BRANDING_LOGO_DATA_URI_MAX_BYTES / 1024)} KB after
            encoding. Saved on this workspace for every viewer.
          </p>
        </div>

        {errorMessage ? (
          <div
            role="alert"
            className="rounded border sui-border-negative sui-bg-notification-negative px-3 py-2 text-sm sui-color-active"
          >
            {errorMessage}
          </div>
        ) : null}
      </div>

      <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t sui-border-weak sui-bg-section px-5 py-4">
        <button
          type="button"
          onClick={onResetToDefaults}
          className="text-sm font-bold sui-color-default underline sui-hover-color-negative"
        >
          Reset to defaults
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border sui-border-default sui-bg-page px-3 py-2 text-sm font-bold sui-color-default transition-colors sui-hover-bg-overlay"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              void handleSave();
            }}
            disabled={isSaving}
            className="rounded px-3 py-2 text-sm font-bold scd-action-primary transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </WorkspaceModalShell>
  );
};

// Map position relative to the metric tile column. Shared workspace
// configuration is authoritative; leftover localStorage keys are
// cleared by the personal-customization reset.
type MapPosition = "right" | "below" | "above";
type MapHeightMode = "match-workspace" | "compact";

type MapLayout = MapPosition | "hidden";

interface MapLayoutRadioBarProps {
  value: MapLayout;
  onChange: (next: MapLayout) => void;
}

const MAP_LAYOUT_OPTIONS = [
  {
    value: "below",
    ariaLabel: "Map below tiles",
    startAdornment: <PanelBottom aria-hidden="true" />,
  },
  {
    value: "right",
    ariaLabel: "Map on the right",
    startAdornment: <PanelRight aria-hidden="true" />,
  },
  {
    value: "above",
    ariaLabel: "Map above tiles",
    startAdornment: <PanelTop aria-hidden="true" />,
  },
  {
    value: "hidden",
    ariaLabel: "Hide map",
    startAdornment: <PanelRightClose aria-hidden="true" />,
  },
] as const;

const MapLayoutRadioBar: React.FC<MapLayoutRadioBarProps> = ({
  value,
  onChange,
}) => (
  <OneCdRadioBar
    ariaLabel="Map layout"
    options={MAP_LAYOUT_OPTIONS}
    value={value}
    onChange={onChange}
  />
);

const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  status,
  onOpenInSearch,
  searchbaseId,
  onConfigure,
}) => {
  const theme = useSplunkTheme();
  const displayValue = formatMapKpiValue(value);
  const statusColor = {
    healthy: theme.severityColorNormal,
    warning: theme.severityColorWarning,
    critical: theme.severityColorCritical,
    unknown: theme.severityColorUnknown,
  }[status];

  return (
    <Card>
      <Card.Header
        actions={() => (
          <TileActionMenu
            label={label}
            onOpenInSearch={onOpenInSearch}
            searchbaseId={searchbaseId}
            onConfigure={onConfigure}
          />
        )}
        title={
          <Heading level={3} data-sui-heading-variant="title3">
            {label}
          </Heading>
        }
      />
      <Card.Body>
        <MapKpiContent>
          <MapKpiValue $status={status} title={displayValue}>
            {displayValue}
          </MapKpiValue>
          <MapKpiStatusBadge
            $status={status}
            label={MAP_KPI_STATUS_LABELS[status]}
            backgroundColor={`color-mix(in srgb, ${statusColor} 50%, transparent)`}
            foregroundColor={theme.contentColorActive}
          />
        </MapKpiContent>
      </Card.Body>
    </Card>
  );
};

const InsightsWorkspacePage: React.FC = () => {
  const [bundle, setBundle] = useState<InsightsWorkspaceBundle | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadInsightsWorkspaces()
      .then((loaded) => {
        if (!cancelled) setBundle(loaded);
      })
      .catch((error) => {
        console.warn(
          "[insights] workspace config unavailable; using packaged fallbacks",
          error,
        );
        if (!cancelled) {
          setBundle({
            workspaces: [...PACKAGED_WORKSPACE_FALLBACKS],
            layouts: {},
            signalRails: Object.fromEntries(
              PACKAGED_WORKSPACE_FALLBACKS.map((workspace) => [
                workspace.id,
                getDefaultSignalTickerConfig(workspace.id),
              ]),
            ),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const workspace = bundle ? getWorkspaceFromLocation(bundle.workspaces) : null;

  useEffect(() => {
    if (!bundle || !workspace) return;
    rememberLastWorkspace(workspace.id, bundle.workspaces);
  }, [bundle, workspace?.id]);

  if (!bundle || !workspace) {
    return (
      <div className="flex min-h-screen items-center justify-center  text-sm font-semibold  sui-bg-page sui-color-default">
        Loading Insights workspaces…
      </div>
    );
  }

  return (
    <InsightsWorkspaceRuntime
      key={workspace.id}
      workspace={workspace}
      workspaces={bundle.workspaces}
      initialLayout={bundle.layouts[workspace.id] ?? {}}
      layouts={bundle.layouts}
      signalRails={bundle.signalRails}
      signalTickerDefault={
        bundle.signalRails[workspace.id] ??
        getDefaultSignalTickerConfig(workspace.id)
      }
      onWorkspaceUpdated={(updated) => {
        setBundle((current) =>
          current
            ? {
                ...current,
                workspaces: current.workspaces.map((candidate) =>
                  candidate.id === updated.id ? updated : candidate,
                ),
              }
            : current,
        );
      }}
      onSignalRailUpdated={(workspaceId, config) => {
        setBundle((current) =>
          current
            ? {
                ...current,
                signalRails: {
                  ...current.signalRails,
                  [workspaceId]: config,
                },
              }
            : current,
        );
      }}
    />
  );
};

export default InsightsWorkspacePage;
