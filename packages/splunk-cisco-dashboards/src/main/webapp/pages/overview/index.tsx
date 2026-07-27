/**
 * Splunk Cisco Dashboards — Overview Page
 *
 * Executive landing page adapted for Splunk and pumped full of
 * dashboards-tooling niceties:
 *   * Time-range picker (default Last 24 hours)
 *   * Auto-refresh interval picker + manual refresh button
 *   * Per-metric searchbase wiring, with saved-search dispatch used only
 *     for searches that are intentionally scheduled
 *   * Threshold-driven status colouring on every metric
 *   * Aggregate health badge derived from those statuses
 *   * Comparison overlay (previous-period dashed line) on every spark
 *   * Click-sparkline → opens the SPL in Splunk Search
 *   * KPI cards under the topology map driven by searchbase or inline SPL
 *   * PNG / PDF export of the entire page
 *   * Keyboard shortcuts (g i, g s, g b, g r, t, r, ?, /)
 *   * Click-to-pin map popups (ESC or X to close)
 *
 * Each "feature" surfaced through this page is independent — see the
 * inline section comments to remove or pare down individual capabilities
 * without rippling the rest of the page.
 */

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createURL } from "@splunk/splunk-utils/url";
import {
  Activity,
  User,
  RefreshCw,
  Pause,
  Download,
  Keyboard,
  RotateCcw,
  Settings2,
  ExternalLink,
  PanelRight,
  PanelBottom,
  PanelTop,
  Map as MapIcon,
  Edit3,
  Upload,
  X,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Table2,
  ClipboardCheck,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Sparkles,
  Shield,
  ShieldCheck,
  ServerCog,
  Network,
  BrickWall,
  Bot,
  Building2,
  Plus,
  Eye,
  EyeOff,
  Search,
  Tag,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { DashboardSection } from "@/common/components/florida/DashboardSection";
import { MetricItem } from "@/common/components/florida/MetricItem";
import { TableTile } from "@/common/components/florida/TableTile";
import { BarBreakdownTile } from "@/common/components/florida/BarBreakdownTile";
import { PieTile } from "@/common/components/florida/PieTile";
import { SingleValueRadialTile } from "@/common/components/florida/SingleValueRadialTile";
import { FillerGaugeTile } from "@/common/components/florida/FillerGaugeTile";
import { MarkerGaugeTile } from "@/common/components/florida/MarkerGaugeTile";
import {
  sparklineVizTypeFromSplunkViz,
  normalizeDataValuesDisplay,
  type SparklineVizType,
} from "@/common/components/florida/Sparkline";
import {
  isFillerGaugeViz,
  isMarkerGaugeViz,
  isPieViz,
  isSingleValueRadialViz,
} from "@/common/components/florida/canvasVizPredicates";
import {
  CustomerTopologyMap,
  CUSTOMER_TOPOLOGY,
  clearCustomerTopologyStorage,
  TopologySiteTable,
  usePersistedTopology,
} from "@/common/components/florida/CustomerTopologyMap";
import {
  DEFAULT_CUSTOMER_TOPOLOGY_SECTION_TITLES,
  type CustomerTopologySectionTitles,
} from "@/common/services/customerTopologyPersistenceService";
import { HealthBadge } from "@/common/components/florida/HealthBadge";
import {
  SignalTickerEditor,
  SignalTickerRail,
  type SignalTickerMetricDefaults,
} from "@/common/components/florida/SignalTickerRail";
import { HelpOverlay } from "@/common/components/florida/HelpOverlay";
import { InfoTooltip } from "@/common/components/florida/InfoTooltip";
import {
  KpiPickerPanel,
  type KpiPickerContext,
  type FactoryTileConfigApplyPatch,
} from "@/common/components/florida/KpiPickerPanel";
import {
  useMetric,
  useKpi,
  useTableData,
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
import { useTheme } from "@/common/hooks/useTheme";
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
import { usePersistedSignalTicker } from "@/common/hooks/usePersistedSignalTicker";
import {
  DEFAULT_OVERVIEW_PROFILE_ID,
  getOverviewProfileFromLocation,
  isOverviewProfileId,
  sectionIdsForProfile,
  type OverviewProfile,
  type OverviewSectionIcon,
} from "@/common/config/overviewProfiles";
import {
  useBrandingOverride,
  readImageAsDataUri,
  BRANDING_LOGO_DATA_URI_MAX_BYTES,
  BRANDING_ACCEPTED_LOGO_MIME_TYPES,
  type BrandingOverride,
} from "@/common/hooks/useBrandingOverride";
import { resolveAppVersions } from "@/common/lib/appVersion";
import { APP_VERSION_LABEL } from "@/common/lib/buildInfo";
import { SortableMetricCard } from "@/common/components/florida/SortableMetricCard";
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
import { ThemeToggle } from "@/common/components/florida/ThemeToggle";
import { runSearch } from "@/common/services/splunkSearchService";
import {
  getSearchbaseCatalogue,
  type SearchbaseRecord,
} from "@/common/services/searchbaseCatalogue";
import {
  loadOverviewFactoryTiles,
  saveOverviewFactoryTiles,
  type OverviewFactoryTilesConfig,
} from "@/common/services/overviewFactoryTilesService";
import { saveFactoryTileConfig } from "@/common/services/searchbaseTileConfigService";
import { useCanManageFactoryTileConfig } from "@/common/hooks/useCanManageFactoryTileConfig";
import { cn } from "@/common/lib/utils";

// =============================================================================
// Branding
// =============================================================================

const APP_NAME = "splunk-cisco-dashboards";
const APP_CATALOG_SEARCH_NAME = "Splunk for Secure Networking";

// Default subtitle shown beneath the customer name when no per-user
// override is set in localStorage. Operators can change the visible
// text per-user via the header pencil → Edit branding panel
// (`scd_overview_branding`); this constant only defines the
// out-of-the-box value for fresh deployments.
const DEFAULT_HEADER_SUBTITLE = "Splunk Executive Insights";
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

const CUSTOMER_NAME_SPL =
  "| makeresults | eval customer_name = `customer_name` | fields customer_name";

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
const SECTION_HEIGHT_STEP_PX = 120;
// Wrapped sections need to budget for the full card floor plus the
// inter-row gap. 152px matched the bare tile min-height too closely and
// caused the third row to be clipped at H1 when a section showed 9 tiles.
const SECTION_WRAPPED_TILE_ROW_STEP_PX = 176;
const SECTION_WRAP_TILE_COUNT = 5;
const SECTION_WRAPPED_TILE_COLUMNS = 3;
const VERTICAL_MAP_MIN_HEIGHT_PX = 420;
const VERTICAL_MAP_COMPACT_MIN_HEIGHT_PX = 360;
const VERTICAL_METRICS_MIN_HEIGHT_PX = 220;
const VERTICAL_METRICS_COMPACT_MIN_HEIGHT_PX = 180;
const VERTICAL_SPLIT_CHROME_ALLOWANCE_PX = 32;

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
  {
    earliest: "-90d@d",
    latest: "now",
    label: "Last 90 days",
    spanSeconds: 90 * 86400,
  },
];
const DEFAULT_TIME_RANGE_LABEL = "Last 24 hours";

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

const plainTextFromHtml = (raw: string | undefined): string | undefined => {
  if (!raw) return undefined;
  const text = raw
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return text || undefined;
};

const parseOverviewProfile = (raw: unknown): OverviewProfile["id"] => {
  if (typeof raw !== "string") return DEFAULT_OVERVIEW_PROFILE_ID;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "overview" || trimmed === "default") {
    return DEFAULT_OVERVIEW_PROFILE_ID;
  }
  return isOverviewProfileId(trimmed) ? trimmed : DEFAULT_OVERVIEW_PROFILE_ID;
};

const parseOverviewSection = (
  raw: unknown,
  profile: OverviewProfile,
): SectionId | undefined => {
  if (typeof raw !== "string") return undefined;
  const candidate = raw.trim() as SectionId;
  return sectionIdsForProfile(profile).includes(candidate)
    ? candidate
    : undefined;
};

const parseOverviewThresholds = (
  raw: unknown,
  fallback?: MetricThresholds,
): MetricThresholds | undefined => {
  if (!isRecord(raw)) return fallback;
  const warning = readOverviewNumber(raw, "warning");
  const critical = readOverviewNumber(raw, "critical");
  const directionRaw = readOverviewString(raw, "direction", 32);
  const direction =
    directionRaw === "lower_is_better" || directionRaw === "higher_is_better"
      ? directionRaw
      : fallback?.direction;
  if (warning === undefined && critical === undefined && !direction)
    return fallback;
  return {
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
  profile: OverviewProfile,
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
    profile: profile.id,
    tileId: slugifyOverviewId(record.id),
    section,
    label: record.searchName.replace(/^Secure Networking\s*-\s*/i, ""),
    subLabel: record.category ?? record.subCategory,
  };
};

interface OverviewMetricBuildOptions {
  tileId?: string;
  section?: SectionId;
  suppressMockOnEmpty?: boolean;
}

const buildOverviewMetricFromDefinition = (
  record: SearchbaseRecord,
  definition: Record<string, unknown>,
  profile: OverviewProfile,
  options: OverviewMetricBuildOptions = {},
): MetricConfig | null => {
  const id = options.tileId ?? readOverviewString(definition, "tileId", 128);
  const section =
    options.section ?? parseOverviewSection(definition.section, profile);
  if (!id || !section) return null;

  const description =
    readOverviewString(definition, "description", 4000) ??
    plainTextFromHtml(record.explanation) ??
    plainTextFromHtml(record.description);
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
    searchbaseId: record.id,
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
  profile: OverviewProfile,
): MetricConfig[] => {
  if (records === null) return [];

  const discovered = new Map<string, MetricConfig>();

  for (const record of records) {
    if (!record.searchName || !record.search) continue;
    const definitions = overviewDefinitionsFromRecord(record).filter(
      (definition) => parseOverviewProfile(definition.profile) === profile.id,
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
  records: SearchbaseRecord[] | null,
  additions: SectionTileAdditionMap,
  profile: OverviewProfile,
  existingMetrics: MetricConfig[],
): MetricConfig[] => {
  if (records === null) return [];

  const recordsById = new Map(records.map((record) => [record.id, record]));
  const existingIds = new Set(existingMetrics.map((metric) => metric.id));
  const existingSearchesBySection = new Set(
    existingMetrics
      .filter((metric) => metric.searchbaseId)
      .map((metric) => `${metric.section}:${metric.searchbaseId}`),
  );
  const out: MetricConfig[] = [];

  for (const section of sectionIdsForProfile(profile)) {
    const searchbaseIds = additions[section] ?? [];
    for (const searchbaseId of searchbaseIds) {
      if (existingSearchesBySection.has(`${section}:${searchbaseId}`)) continue;
      const record = recordsById.get(searchbaseId);
      if (!record?.searchName || !record.search) continue;
      const tileId = overviewAdditionTileId(section, searchbaseId);
      if (existingIds.has(tileId)) continue;

      const definitions = overviewDefinitionsFromRecord(record).filter(
        (definition) => parseOverviewProfile(definition.profile) === profile.id,
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
          suppressMockOnEmpty: true,
        },
      );
      if (!metric) continue;
      out.push(metric);
      existingIds.add(tileId);
      existingSearchesBySection.add(`${section}:${searchbaseId}`);
    }
  }

  return out;
};

const MAP_FOOTER_SLOTS = ["primary", "secondary"] as const;
type MapFooterSlot = (typeof MAP_FOOTER_SLOTS)[number];

const DISABLED_MAP_FOOTER_KPI_CONFIG: KpiConfig = {
  id: "__map_footer_unavailable",
  label: "",
  valueField: "value",
  mockValue: "",
};

const isMapFooterSlot = (value: unknown): value is MapFooterSlot =>
  typeof value === "string" &&
  (MAP_FOOTER_SLOTS as readonly string[]).includes(value.trim());

const buildOverviewMapFooterConfig = (
  records: SearchbaseRecord[] | null,
): KpiConfig[] => {
  if (records === null) return [];

  const discovered = new Map<MapFooterSlot, KpiConfig>();

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
    });
  }

  return MAP_FOOTER_SLOTS.map((slot) => discovered.get(slot)).filter(
    (item): item is KpiConfig => Boolean(item),
  );
};

// =============================================================================
// Section icon rendering
// =============================================================================

const SECTION_ICON_COMPONENTS: Record<OverviewSectionIcon, LucideIcon> = {
  activity: Activity,
  shield: Shield,
  building: Building2,
  sparkles: Sparkles,
  "shield-check": ShieldCheck,
  "server-cog": ServerCog,
  network: Network,
  firewall: BrickWall,
  bot: Bot,
};

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
const DEFAULT_PRIORITY_DRILLDOWN_VIEW = "statewide_exercise_v1";

// App-local allow-list only. These are shipped views in this app, curated
// from default/data/ui/nav/default.xml plus default/data/ui/views/*.xml.
// Archive, overview, test, template, admin, and platform utility views are
// intentionally excluded from the executive drill-down picker.
const APP_PRIORITY_DRILLDOWNS: readonly AppPriorityDrilldown[] = [
  {
    viewName: "statewide_exercise_v1",
    title: "Statewide Network Activation Report",
    description:
      "Client health, readiness, and activation signals across all sites.",
    timeToken: "time_tok",
  },
  {
    viewName: "it_health_v1",
    title: "IT Health",
    description:
      "Critical systems, network posture, device health, and compliance.",
    timeToken: "global_time",
  },
  {
    viewName: "security_v1",
    title: "Security Resilience",
    description: "Firewall, identity, XDR, IDS/IPS, DNS, and endpoint signals.",
    timeToken: "global_time",
  },
  {
    viewName: "building_v1",
    title: "Building Intelligence",
    description:
      "Cisco Spaces occupancy, wireless trust, and workplace telemetry.",
    timeToken: "global_time",
  },
  {
    viewName: "health_monitoring",
    title: "Health Monitoring",
    description: "Operational health monitoring for sites and infrastructure.",
  },
  {
    viewName: "netops_readiness_v1",
    title: "NetOps Readiness",
    description: "Readiness, site posture, and field-operation validation.",
    timeToken: "global_time",
  },
  {
    viewName: "spaces_intelligence_v1",
    title: "Spaces Intelligence",
    description:
      "Cisco Spaces intelligence for locations, devices, and activity.",
    timeToken: "global_time",
  },
  {
    viewName: "workplace_spog_v1",
    title: "Workplace Single Pane",
    description: "Unified workplace and collaboration operating view.",
    timeToken: "global_time",
  },
  {
    viewName: "asset_inventory_v1",
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
    viewName: "topology_canvas_v1",
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
    const raw = window.localStorage.getItem(PRIORITY_DRILLDOWN_STORAGE_KEY);
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
      PRIORITY_DRILLDOWN_STORAGE_KEY,
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
    window.localStorage.removeItem(PRIORITY_DRILLDOWN_STORAGE_KEY);
  } catch {
    // Storage unavailable; ignore.
  }
};

// =============================================================================
// Splunk Search drilldown URL builder
// =============================================================================

// Locale-aware URL builder for a sibling Splunk view inside this app
// (e.g. statewide_exercise_v1). Mirrors splunkSearchAppUrl's locale
// detection so the URL stays valid in non-en-US Splunk installs.
const splunkViewAppUrl = (
  viewName: string,
  range?: TimeRange,
  timeToken?: string,
): string => {
  const path =
    typeof window !== "undefined" ? window.location.pathname : "/en-US";
  const localeMatch = path.match(/^\/([a-z]{2}-[A-Z]{2})\//);
  const locale = localeMatch ? localeMatch[1] : "en-US";
  const baseUrl = `/${locale}/app/${APP_NAME}/${viewName}`;
  if (!range || !timeToken) return baseUrl;

  const params = new URLSearchParams();
  params.set(`form.${timeToken}.earliest`, range.earliest);
  params.set(`form.${timeToken}.latest`, range.latest);
  return `${baseUrl}?${params.toString()}`;
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

type MetricDetailTableColumnKind = "text" | "status" | "metric";

interface MetricDetailTableColumn {
  field: string;
  label: string;
  align?: "left" | "right";
  kind?: MetricDetailTableColumnKind;
  fallback?: string;
  truncate?: boolean;
}

interface MetricDetailTableConfig {
  title: string;
  buttonTitle: string;
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
  const drilldownName =
    userDrilldown === null
      ? ""
      : (userDrilldown ?? source?.drilldownSearchName)?.trim();
  if (!source || !drilldownName || !searchbaseByName) return null;
  const detail = searchbaseByName.get(drilldownName);
  if (!detail?.search) return null;
  const options = detail.vizOptions;
  const columns = parseDetailTableColumns(options?.columns);
  const subtitleTemplate =
    readDetailStringOption(options, "modalSubtitle") ??
    "Detail table for {searchName} over {rangeLabel}.";
  const tag = `detail_table_${detail.id || detail.searchName}`.replace(
    /[^A-Za-z0-9_]+/g,
    "_",
  );
  return {
    title:
      readDetailStringOption(options, "modalTitle") ??
      `${source.searchName} Details`,
    buttonTitle:
      source.drilldownButtonTitle ??
      readDetailStringOption(options, "buttonTitle") ??
      `View ${source.searchName} detail table`,
    subtitle: (range) =>
      interpolateDetailSubtitle(subtitleTemplate, source, detail, range),
    spl: detail.search,
    dispatchContext: detail.dispatchContext,
    tag,
    rowKeyField:
      readDetailStringOption(options, "rowKeyField") ?? columns[0]?.field ?? "",
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
  onConfigure: () => void;
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
    if (!effective.savedSearch && !effective.searchbaseId) return effective;
    if (
      searchbaseByName === null ||
      searchbaseByName === undefined ||
      searchbaseById === null ||
      searchbaseById === undefined
    ) {
      return { ...effective, savedSearch: undefined, spl: undefined };
    }
    const sb = resolveSearchbaseRecordForConfig(
      effective,
      searchbaseById,
      searchbaseByName,
    );
    if (sb && sb.search) {
      return {
        ...effective,
        spl: sb.search,
        savedSearch: undefined,
        dispatchContext: sb.dispatchContext,
      };
    }
    return { ...effective, savedSearch: undefined, spl: undefined };
  }, [effective, searchbaseById, searchbaseByName]);

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
        searchbaseDrilldowns,
      ),
    [sbRecord, searchbaseByName, searchbaseDrilldowns],
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
      dataValuesDisplay={
        hidePeak
          ? "off"
          : compactDensity && dataValuesDisplay === "minmax"
            ? "maxonly"
            : dataValuesDisplay
      }
      status={result.status}
      source={result.source}
      onOpenInSearch={drilldownSpl ? handleClick : undefined}
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
    <TableTile
      label={effective.label}
      subLabel={effective.subLabel}
      description={effective.description}
      descriptionFootnote={undefined}
      thresholdNote={effective.thresholdNote}
      infoAnchor={infoAnchor}
      rows={result.rows}
      columns={result.columns}
      totalRowCount={result.totalRowCount}
      source={result.source}
      onOpenInSearch={drilldownSpl ? handleClick : undefined}
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
    <BarBreakdownTile
      label={effective.label}
      subLabel={effective.subLabel}
      description={effective.description}
      descriptionFootnote={undefined}
      thresholdNote={effective.thresholdNote}
      infoAnchor={infoAnchor}
      rows={result.rows}
      columns={result.columns}
      source={result.source}
      onOpenInSearch={drilldownSpl ? handleClick : undefined}
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
      descriptionFootnote={undefined}
      thresholdNote={effective.thresholdNote}
      infoAnchor={infoAnchor}
      rows={result.rows}
      columns={result.columns}
      seriesColors={seriesColorsFromVizOptions(sbRecord?.vizOptions)}
      source={result.source}
      onOpenInSearch={drilldownSpl ? handleClick : undefined}
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
    descriptionFootnote: undefined,
    thresholdNote: effective.thresholdNote,
    value,
    unit,
    accentColor: tileColor,
    vizOptions: sbRecord?.vizOptions,
    source: result.source,
    onOpenInSearch: drilldownSpl ? handleClick : undefined,
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

const OverviewPage: React.FC = () => {
  // ------------------------------ Theme ------------------------------
  const { theme, resolvedTheme, cycle: cycleTheme } = useTheme();
  const availableDashboardHeight = useAvailableDashboardHeight();
  const compactDensity =
    availableDashboardHeight !== null &&
    availableDashboardHeight < COMPACT_HEIGHT_THRESHOLD_PX;
  const dashboardShellStyle = useMemo<React.CSSProperties>(
    () => ({
      height:
        availableDashboardHeight !== null
          ? `${availableDashboardHeight}px`
          : "100vh",
    }),
    [availableDashboardHeight],
  );
  const overviewProfile = useMemo(() => getOverviewProfileFromLocation(), []);
  const profileSectionIds = useMemo(
    () => sectionIdsForProfile(overviewProfile),
    [overviewProfile],
  );

  // ------------------------------ Branding ------------------------------
  //
  // Three layered defaults govern what the header chrome shows:
  //
  //   1. `brandingOverride` (per-user, localStorage) — values from
  //      the header pencil → Edit branding panel. Highest priority.
  //   2. `customerName` (per-deployment, Splunk macro) — the
  //      `[customer_name]` macro value fetched at mount. Operator-
  //      controlled via `local/macros.conf`.
  //   3. Hardcoded fallbacks (`DEFAULT_HEADER_TITLE_FALLBACK`,
  //      `DEFAULT_HEADER_SUBTITLE`, `DEFAULT_LOGO_DATA_URI`) — what
  //      every fresh install ships with. The default logo is a
  //      neutral network mark so the app doesn't imply a specific
  //      customer, agency, or vendor brand before setup.
  //
  // `effectiveTitle` / `effectiveSubtitle` / `effectiveLogoSrc`
  // (derived below) collapse those layers into the strings the
  // JSX actually renders.
  const [customerName, setCustomerName] = useState<string>("");
  const [logoSrc, setLogoSrc] = useState<string>(DEFAULT_LOGO_DATA_URI);
  const [splunkUsername, setSplunkUsername] = useState<string>("");
  const [appVersionLabel, setAppVersionLabel] =
    useState<string>(APP_VERSION_LABEL);
  const [appUpdateVersion, setAppUpdateVersion] = useState<string>("");
  const appCatalogUrl = createURL("/manager/launcher/appsremote", {
    order: "relevance",
    query: APP_CATALOG_SEARCH_NAME,
    offset: 0,
  });
  const {
    override: brandingOverride,
    setOverride: setBrandingOverride,
    resetAll: resetBrandingOverride,
  } = useBrandingOverride(overviewProfile.id);
  const [isBrandingEditorOpen, setBrandingEditorOpen] =
    useState<boolean>(false);
  const [isSectionTitlesEditorOpen, setSectionTitlesEditorOpen] =
    useState<boolean>(false);

  const effectiveTitle =
    brandingOverride.title ||
    overviewProfile.headerTitle ||
    customerName ||
    DEFAULT_HEADER_TITLE_FALLBACK;
  const effectiveSubtitle =
    brandingOverride.subtitle ||
    overviewProfile.headerSubtitle ||
    DEFAULT_HEADER_SUBTITLE;
  // Logo precedence: explicit override (data URI from upload) →
  // current `logoSrc` (the neutral built-in default unless this
  // session has recovered from an image error). Header branding is
  // intentionally independent from tile/layout factory reset.
  const effectiveLogoSrc = brandingOverride.logoDataUri || logoSrc;

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
    profileId: overviewProfile.id,
    availableSections: profileSectionIds,
    defaultSections: overviewProfile.defaultVisibleSections,
    maxSections: overviewProfile.maxVisibleSections,
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

  const {
    additions: sectionTileAdditions,
    getAdditions: getSectionTileAdditions,
    addTile: addSectionTile,
    removeTile: removeSectionTile,
    resetAll: resetAllSectionTileAdditions,
  } = usePersistedSectionTileAdditions({
    profileId: overviewProfile.id,
    availableSections,
  });
  const {
    isHidden: isSectionTileHidden,
    hideTile: hideSectionTile,
    showTile: showSectionTile,
    resetAll: resetAllSectionHiddenTiles,
  } = usePersistedSectionHiddenTiles({
    profileId: overviewProfile.id,
    availableSections,
  });

  const baseMetricConfig = useMemo(
    () => buildOverviewMetricConfig(searchbaseRecords, overviewProfile),
    [overviewProfile, searchbaseRecords],
  );
  const addedMetricConfig = useMemo(
    () =>
      buildAddedOverviewMetricConfig(
        searchbaseRecords,
        sectionTileAdditions,
        overviewProfile,
        baseMetricConfig,
      ),
    [
      baseMetricConfig,
      overviewProfile,
      searchbaseRecords,
      sectionTileAdditions,
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

  // ------------------------------ Shared factory tile layout ------------------------------
  //
  // The searchbase overview metadata is the full tile catalogue. This
  // app-level config controls only the shared factory order and visible
  // count for each section; it never carries search bindings.
  const [overviewFactoryTiles, setOverviewFactoryTiles] =
    useState<OverviewFactoryTilesConfig>({});
  const [factoryDefaultsStatus, setFactoryDefaultsStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  useEffect(() => {
    let cancelled = false;
    loadOverviewFactoryTiles(overviewProfile.id)
      .then((config) => {
        if (cancelled) return;
        setOverviewFactoryTiles(config);
      })
      .catch((error) => {
        if (cancelled) return;
        // Keep Overview usable even if the optional shared
        // defaults config is unavailable; searchbase overview
        // metadata still controls the tile roster.
        console.warn("[overview] factory tile defaults unavailable", error);
        setOverviewFactoryTiles({});
      });
    return () => {
      cancelled = true;
    };
  }, [overviewProfile.id]);

  const factoryTileCountDefaults = useMemo(() => {
    const out: Partial<Record<SectionId, number>> = {};
    for (const section of availableSections) {
      const count = overviewFactoryTiles[section]?.visibleCount;
      if (typeof count === "number" && Number.isFinite(count)) {
        out[section] = count;
      }
    }
    return out;
  }, [availableSections, overviewFactoryTiles]);

  const getFactoryTileOrder = useCallback(
    (section: SectionId, sectionMetrics: MetricConfig[]): string[] => {
      const canonicalIds = sectionMetrics.map((metric) => metric.id);
      const configuredIds = overviewFactoryTiles[section]?.tiles ?? [];
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
    [overviewFactoryTiles],
  );

  // ------------------------------ Section tile-count preference ------------------------------
  //
  // Per-user, per-section "how many tiles do I want visible". The
  // user dials it via the small `−  N  +` pill on each section
  // header. Trailing tiles (from the bottom of the searchbase-backed catalogue for
  // that section) are the ones that hide first when narrowing —
  // picker overrides on hidden tiles are NOT cleared, so a user
  // who customises tile #5, dials down to 3, then back up to 5,
  // gets their customisation back unchanged.
  //
  // Bounds come from the active overview profile, with per-section
  // defaults from overview_factory_tiles.conf. Secure Networking ships
  // with nine visible factory KPIs per section; operators can save a
  // different shared default from the
  // picker footer, and individual users can still dial the visible count
  // up/down with the section pill.
  // Returning users keep whatever count they had configured because
  // the per-section preference is keyed off localStorage.
  //
  // Declared up here (before the aggregate status block) because
  // the HealthBadge filter below needs to know which tiles are
  // currently visible.
  const {
    counts: sectionTileCounts,
    bounds: sectionTileBounds,
    setCount: setSectionTileCount,
    resetAll: resetAllSectionTileCounts,
  } = usePersistedSectionTileCounts({
    minCount: overviewProfile.minTileCount,
    maxCount: overviewProfile.maxTileCount,
    defaultCount: factoryTileCountDefaults,
    fallbackDefault: overviewProfile.fallbackTileCount,
    profileId: overviewProfile.id,
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
    defaultLevel: 1,
    profileId: overviewProfile.id,
    availableSections,
  });

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
    profileId: overviewProfile.id,
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

  // The HealthBadge should only reflect tiles the user is
  // currently *seeing*. When a tile is hidden (because the user
  // dialled the section count down), its last reported status
  // would otherwise stick around in `statuses` and skew the
  // aggregate. Recompute the visible-tile id set whenever the
  // per-section count preference changes and use it as the gate
  // both for the badge and (below) for the section render.
  const visibleMetricIds = useMemo(() => {
    const out = new Set<string>();
    for (const section of visibleSections) {
      // Same pipeline the render below uses: canonical ids ->
      // apply user reorder -> slice to visible count. Keeping
      // the badge filter and the render in lockstep means a
      // tile dragged into the visible window also gets its
      // status counted in the aggregate, and a tile dragged
      // out is dropped immediately.
      const sectionMetrics = renderMetricConfig.filter(
        (m) => m.section === section,
      );
      const canonicalIds = getFactoryTileOrder(section, sectionMetrics);
      const orderedIds = getSectionTileOrder(section, canonicalIds);
      const visible = orderedIds.slice(0, sectionTileCounts[section]);
      for (const id of visible) out.add(id);
    }
    return out;
  }, [
    visibleSections,
    sectionTileCounts,
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

  // ------------------------------ Help overlay ------------------------------
  const [helpOpen, setHelpOpen] = useState(false);

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
          const name = entry.drilldownSearchName?.trim();
          if (name) drilldownNames.add(name);
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
  // A configurable, moving executive KPI rail. This first slice follows the
  // page's existing per-browser customization model for KPI bindings; the
  // selected entries still come from `searchbase.conf` so the content model
  // stays app-owned and familiar to operators.
  const {
    config: signalTickerConfig,
    setConfig: setSignalTickerConfig,
    resetAll: resetSignalTickerConfig,
    itemCount: signalTickerItemCount,
  } = usePersistedSignalTicker(overviewProfile.id);
  const [signalTickerEditorOpen, setSignalTickerEditorOpen] = useState(false);
  const searchbaseCatalogue = useMemo(() => {
    if (!visibleSearchbaseCatalogue) return [];
    const fallbackDrilldownNames = new Set<string>();
    for (const entry of visibleSearchbaseCatalogue) {
      const name = entry.drilldownSearchName?.trim();
      if (name) fallbackDrilldownNames.add(name);
    }
    const drilldownNames =
      signalTickerDrilldownSearchNames ?? fallbackDrilldownNames;
    return visibleSearchbaseCatalogue
      .filter((entry) => {
        const isDrilldownSearch = drilldownNames.has(entry.searchName);
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
  const [regionalView, setRegionalView] = useState<RegionalView>("map");

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
  const MAP_POS_KEY = "scd_overview_map_pos";
  const MAP_POS_DEFAULT: MapPosition = "right";
  const [mapPosition, setMapPosition] = useState<MapPosition>(() => {
    if (typeof window === "undefined") return MAP_POS_DEFAULT;
    try {
      const saved = window.localStorage.getItem(MAP_POS_KEY);
      return saved === "right" || saved === "below" || saved === "above"
        ? saved
        : MAP_POS_DEFAULT;
    } catch {
      return MAP_POS_DEFAULT;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(MAP_POS_KEY, mapPosition);
    } catch {
      // localStorage may be disabled (private mode / quota);
      // the choice still works for the session, we just can't
      // persist it. Mirrors the split-percentage handling.
    }
  }, [mapPosition]);
  const MAP_VISIBILITY_KEY = "scd_overview_map_visible";
  const MAP_VISIBLE_DEFAULT = true;
  const [mapVisible, setMapVisible] = useState<boolean>(() => {
    if (typeof window === "undefined") return MAP_VISIBLE_DEFAULT;
    try {
      const saved = window.localStorage.getItem(MAP_VISIBILITY_KEY);
      return saved === null ? MAP_VISIBLE_DEFAULT : saved !== "false";
    } catch {
      return MAP_VISIBLE_DEFAULT;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(MAP_VISIBILITY_KEY, String(mapVisible));
    } catch {
      // localStorage may be disabled; the toggle still applies
      // for the current session.
    }
  }, [MAP_VISIBILITY_KEY, mapVisible]);
  const toggleMapVisibility = useCallback(() => {
    setMapVisible((visible) => !visible);
  }, []);
  const activeMapPosition: MapPosition | "hidden" = mapVisible
    ? mapPosition
    : "hidden";
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
  // gets 1/3. Pairs with `MAP_POS_DEFAULT = 'right'` to put the
  // headline KPI rails on the left and the topology map as the
  // anchor visual on the right at boot. Earlier revisions used
  // 58.33% (= 7/12, matching the legacy fixed grid), but that left
  // the map column too wide for an exec view where the metrics are
  // the primary read.
  const SPLIT_KEY = "scd_overview_split_pct";
  const SPLIT_DEFAULT = 66.67;
  const SPLIT_MIN = 35;
  const SPLIT_MAX = 80;
  const [leftPct, setLeftPct] = useState<number>(() => {
    if (typeof window === "undefined") return SPLIT_DEFAULT;
    try {
      const saved = window.localStorage.getItem(SPLIT_KEY);
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
    const visibleCount = Math.min(
      sectionTileCounts[section],
      Math.min(sectionTileBounds.maxCount, sectionMetricCount),
    );
    const estimatedTileRows =
      visibleCount >= SECTION_WRAP_TILE_COUNT
        ? Math.ceil(visibleCount / SECTION_WRAPPED_TILE_COLUMNS)
        : 1;
    const heightLevel =
      sectionHeights[section] ?? sectionHeightBounds.defaultLevel;
    const baseMinHeight = compactDensity
      ? SECTION_HEIGHT_COMPACT_BASE_PX
      : SECTION_HEIGHT_BASE_PX;
    return Math.max(
      verticalMetricsMinHeight,
      baseMinHeight +
        (heightLevel - sectionHeightBounds.minLevel) * SECTION_HEIGHT_STEP_PX +
        (estimatedTileRows - 1) * SECTION_WRAPPED_TILE_ROW_STEP_PX,
    );
  }, [
    compactDensity,
    sectionHeightBounds.defaultLevel,
    sectionHeightBounds.minLevel,
    sectionHeights,
    sectionTileBounds.maxCount,
    sectionTileCounts,
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

  // ------------------------------ Customer name fetch ------------------------------
  useEffect(() => {
    let cancelled = false;
    runSearch({
      spl: CUSTOMER_NAME_SPL,
      earliestTime: "-1m",
      latestTime: "now",
      tag: "customer_name",
    })
      .then((res) => {
        if (cancelled) return;
        const rows = (res?.results ?? []) as Array<Record<string, unknown>>;
        const raw = rows[0]?.customer_name;
        const name = typeof raw === "string" ? raw.trim() : "";
        setCustomerName(name);
      })
      .catch(() => {
        if (!cancelled) setCustomerName("");
      });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  // ------------------------------ Installed app identity fetch ------------------------------
  // The package step stamps the release build into the installed app.conf
  // after webpack has compiled the bundle. Prefer that live value so the
  // operator sees the version/build Splunk is actually running. Splunk's own
  // Splunkbase poll writes a pending release to `update.version`; when present,
  // the header exposes the same Manage Apps upgrade link used by the Catalyst TA.
  // Retain the compile-time label as a resilient fallback when the endpoint is
  // unavailable.
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
        const { version, updateVersion } = resolveAppVersions({
          installedVersion: content.version,
          updateVersion: content["update.version"],
        });
        const build =
          typeof content.build === "string" ||
          typeof content.build === "number"
            ? String(content.build).trim()
            : "";
        if (version) {
          setAppVersionLabel(`v${version}${build ? ` · Build ${build}` : ""}`);
        }
        setAppUpdateVersion(updateVersion);
      })
      .catch(() => {
        // Keep the compile-time label when app metadata is unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // ------------------------------ Splunk user fetch ------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    let cancelled = false;
    const bootstrap = (
      window as unknown as {
        $C?: {
          USERNAME?: string;
          username?: string;
          USER?: { name?: string; username?: string };
          user?: { name?: string; username?: string };
        };
      }
    ).$C;
    const bootstrapName =
      bootstrap?.USERNAME ??
      bootstrap?.username ??
      bootstrap?.USER?.username ??
      bootstrap?.USER?.name ??
      bootstrap?.user?.username ??
      bootstrap?.user?.name ??
      "";

    fetch(
      `${splunkLocalePrefix()}/splunkd/__raw/services/authentication/current-context?output_mode=json`,
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
        const raw =
          content.username ?? content.user ?? content.name ?? bootstrapName;
        const username = typeof raw === "string" ? raw.trim() : "";
        setSplunkUsername(username);
      })
      .catch(() => {
        if (!cancelled) setSplunkUsername(bootstrapName.trim());
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
  } = usePersistedMetricOverrides(overviewProfile.id);
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
  } = usePersistedSearchbaseDrilldowns(overviewProfile.id);
  const [pickerContext, setPickerContext] = useState<KpiPickerContext | null>(
    null,
  );
  const [addTileSection, setAddTileSection] = useState<SectionId | null>(null);
  const [activeDetailTable, setActiveDetailTable] =
    useState<MetricDetailTableConfig | null>(null);

  const closeAddTilePicker = useCallback(() => setAddTileSection(null), []);

  const handleAddSearchToSection = useCallback(
    (section: SectionId, record: SearchbaseRecord) => {
      if (!record.id) return;
      const sectionMetrics = metricConfig.filter((m) => m.section === section);
      const visibleSectionMetrics = renderMetricConfig.filter(
        (m) => m.section === section,
      );
      const currentSearchbaseIds = new Set(
        sectionMetrics
          .map((metric) => metric.searchbaseId)
          .filter((id): id is string => Boolean(id)),
      );
      if (currentSearchbaseIds.has(record.id)) return;

      const currentVisibleCount = Math.min(
        sectionTileCounts[section],
        Math.min(sectionTileBounds.maxCount, visibleSectionMetrics.length),
      );

      const newTileId = overviewAdditionTileId(section, record.id);
      const canonicalIds = getFactoryTileOrder(section, visibleSectionMetrics);
      const orderedIds = getSectionTileOrder(section, canonicalIds);
      const nextOrder = orderedIds.filter((id) => id !== newTileId);
      const insertAt =
        currentVisibleCount >= sectionTileBounds.maxCount
          ? Math.max(0, currentVisibleCount - 1)
          : Math.min(currentVisibleCount, nextOrder.length);
      nextOrder.splice(insertAt, 0, newTileId);

      addSectionTile(section, record.id);
      setSectionTileOrder(section, nextOrder);
      setSectionTileCount(
        section,
        Math.min(
          sectionTileBounds.maxCount,
          currentVisibleCount + 1,
          visibleSectionMetrics.length + 1,
        ),
      );
    },
    [
      addSectionTile,
      getFactoryTileOrder,
      getSectionTileOrder,
      metricConfig,
      renderMetricConfig,
      sectionTileBounds.maxCount,
      sectionTileCounts,
      setSectionTileCount,
      setSectionTileOrder,
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
      removeAddedSearchbaseIdFromSection(section, record.id);
    },
    [removeAddedSearchbaseIdFromSection],
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
          metric.searchbaseId === record.id &&
          isSectionTileHidden(section, metric.id),
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
      setSectionTileCount(
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
      isSectionTileHidden,
      metricConfig,
      renderMetricConfig,
      sectionTileBounds.maxCount,
      sectionTileCounts,
      setSectionTileCount,
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

  // Read the persisted topology so the dashboard header can show the
  // user's edited name / subtitle from the topology editor (instead of
  // hardcoded "Network Topology" / "Site connectivity and path
  // health"). The same hook the map uses; same localStorage key, so
  // edits land here without any manual sync.
  const {
    topology: persistedTopology,
    sectionTitles,
    saveSectionTitles,
  } = usePersistedTopology(CUSTOMER_TOPOLOGY);
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
    for (const section of overviewProfile.sections) {
      const Icon = SECTION_ICON_COMPONENTS[section.icon];
      out[section.id] = {
        title: sectionTitles[section.id] || section.title,
        linkText: section.linkText,
        href: section.href,
        icon: <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />,
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
  }, [overviewProfile, sectionTitles]);

  const addTilePickerState = useMemo(() => {
    if (!addTileSection) return null;
    const sectionMetrics = metricConfig.filter(
      (m) => m.section === addTileSection,
    );
    const visibleSectionMetrics = renderMetricConfig.filter(
      (m) => m.section === addTileSection,
    );
    const currentSearchbaseIds = new Set(
      sectionMetrics
        .map((metric) => metric.searchbaseId)
        .filter((id): id is string => Boolean(id)),
    );
    const hiddenSearchbaseIds = new Set(
      sectionMetrics
        .filter((metric) => isSectionTileHidden(addTileSection, metric.id))
        .map((metric) => metric.searchbaseId)
        .filter((id): id is string => Boolean(id)),
    );
    const currentVisibleCount = Math.min(
      sectionTileCounts[addTileSection],
      Math.min(sectionTileBounds.maxCount, visibleSectionMetrics.length),
    );
    return {
      section: addTileSection,
      sectionTitle:
        effectiveSectionMeta[addTileSection]?.title ?? addTileSection,
      currentSearchbaseIds,
      hiddenSearchbaseIds,
      locallyAddedSearchbaseIds: new Set(
        getSectionTileAdditions(addTileSection),
      ),
      currentTileCount: sectionMetrics.length,
      currentVisibleCount,
    };
  }, [
    addTileSection,
    effectiveSectionMeta,
    getSectionTileAdditions,
    isSectionTileHidden,
    metricConfig,
    renderMetricConfig,
    sectionTileBounds.maxCount,
    sectionTileCounts,
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
      },
    ) => {
      // Search binding, value field, label, and thresholds are
      // admin-controlled (searchbase.conf) now — `current` IS
      // the effective value, no per-user override to layer on
      // top. Only chart style / display flags still come from
      // the viewer's own localStorage override.
      const ov: MetricOverride | undefined = overrides[tileId];
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
  const { canManage: canManageFactoryConfig } = useCanManageFactoryTileConfig();
  const [factoryTileConfigStatus, setFactoryTileConfigStatus] = useState<
    "idle" | "saving" | "saved" | "error"
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

      setFactoryTileConfigStatus("saving");
      try {
        await saveFactoryTileConfig({
          tileId: patch.tileId,
          profileId: overviewProfile.id,
          section:
            pickerContext?.sectionId ??
            overviewProfile.defaultVisibleSections[0] ??
            "custom",
          fromStanzaId,
          thresholds: patch.thresholds,
          dataMapping: patch.dataMapping,
          searchRebind: toStanzaId ? { toStanzaId } : undefined,
          drilldownSearchName: patch.drilldownSearchName,
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
    [overviewProfile.id, pickerContext, searchbaseByName],
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
  //   • sectionTileOrder.v1           — drag-to-reorder preference
  //   • customerTopology.v4           — retired per-browser map payload
  //   • scd_overview_split_pct        — tiles ↔ map splitter position
  //   • scd_overview_map_pos          — map position (right / below / above)
  //   • scd_overview_map_visible      — topology map visibility
  //   • priorityDrilldown.v1          — pinned app-local drill-down target
  //   • signalTicker.v1               — moving KPI rail selection
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
    resetAllSectionTileOrder();
    resetSignalTickerConfig();
    clearCustomerTopologyStorage();
    setTopologyResetKey((n) => n + 1);
    setLeftPct(SPLIT_DEFAULT);
    setMapPosition(MAP_POS_DEFAULT);
    setMapVisible(MAP_VISIBLE_DEFAULT);
    setSelectedPriorityDrilldownView(DEFAULT_PRIORITY_DRILLDOWN_VIEW);
    clearPriorityDrilldownView();
    setAddTileSection(null);
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.removeItem(SPLIT_KEY);
        window.localStorage.removeItem(MAP_POS_KEY);
        window.localStorage.removeItem(MAP_VISIBILITY_KEY);
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
    resetAllSectionTileOrder,
    resetSignalTickerConfig,
    SPLIT_KEY,
    SPLIT_DEFAULT,
    setLeftPct,
    MAP_POS_KEY,
    MAP_POS_DEFAULT,
    setMapPosition,
    MAP_VISIBILITY_KEY,
    MAP_VISIBLE_DEFAULT,
    setMapVisible,
  ]);

  const handleSaveOverviewFactoryDefaults = useCallback(async () => {
    const next: OverviewFactoryTilesConfig = {};
    for (const section of availableSections) {
      // Shared factory defaults must stay tied to searchbase-owned
      // Overview definitions. Local additions are intentionally
      // per-user until an admin promotes them by adding proper
      // viz_options.overview metadata to searchbase.conf.
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
      };
    }

    setFactoryDefaultsStatus("saving");
    try {
      await saveOverviewFactoryTiles(next, overviewProfile.id);
      setOverviewFactoryTiles(next);
      setFactoryDefaultsStatus("saved");
      if (typeof window !== "undefined") {
        window.setTimeout(() => setFactoryDefaultsStatus("idle"), 2400);
      }
    } catch (error) {
      console.error("[overview] failed to save factory tile defaults", error);
      setFactoryDefaultsStatus("error");
      if (typeof window !== "undefined") {
        window.alert(
          error instanceof Error
            ? error.message
            : "Could not save Overview factory defaults.",
        );
        window.setTimeout(() => setFactoryDefaultsStatus("idle"), 4000);
      }
    }
  }, [
    availableSections,
    baseMetricConfig,
    getFactoryTileOrder,
    getSectionTileOrder,
    sectionTileBounds.maxCount,
    sectionTileCounts,
    overviewProfile.id,
  ]);

  // ------------------------------ Map footer ------------------------------
  // Same dispatch rules as the main metric grid: searchbase.conf
  // entries resolve to literal SPL so the footer value, picker preview,
  // and Open in Search action all point at the same query.
  // Search binding / value field / label for the map footer cards
  // are admin-controlled (searchbase.conf `viz_options.mapFooter`)
  // now, same as the main tile grid — `base` is already the
  // effective value, no per-user override to layer on top.
  const buildEffectiveMapFooterKpiCfg = (base: KpiConfig): KpiConfig => {
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
  const effectiveMapPrimaryCfg = useMemo<KpiConfig>(
    () =>
      mapPrimaryBaseCfg
        ? buildEffectiveMapFooterKpiCfg(mapPrimaryBaseCfg)
        : DISABLED_MAP_FOOTER_KPI_CONFIG,
    [mapPrimaryBaseCfg, searchbaseById, searchbaseByName],
  );
  const effectiveMapSecondaryCfg = useMemo<KpiConfig>(
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
  const mapPrimaryOverride = mapPrimaryBaseCfg
    ? overrides[mapPrimaryBaseCfg.id]
    : undefined;
  const mapSecondaryOverride = mapSecondaryBaseCfg
    ? overrides[mapSecondaryBaseCfg.id]
    : undefined;
  const mapPrimaryBaseRecord = mapPrimaryBaseCfg
    ? resolveSearchbaseRecordForConfig(
        mapPrimaryBaseCfg,
        searchbaseById,
        searchbaseByName,
      )
    : null;
  const mapSecondaryBaseRecord = mapSecondaryBaseCfg
    ? resolveSearchbaseRecordForConfig(
        mapSecondaryBaseCfg,
        searchbaseById,
        searchbaseByName,
      )
    : null;
  const mapPrimaryDrilldownSpl = mapPrimary.spl;
  const mapSecondaryDrilldownSpl = mapSecondary.spl;
  const handleMapPrimaryOpenInSearch = useCallback(() => {
    if (!mapPrimaryDrilldownSpl) return;
    const url = splunkSearchAppUrl(
      mapPrimaryDrilldownSpl,
      timeRange,
      effectiveMapPrimaryCfg.dispatchContext,
    );
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }, [
    effectiveMapPrimaryCfg.dispatchContext,
    mapPrimaryDrilldownSpl,
    timeRange,
  ]);
  const handleMapSecondaryOpenInSearch = useCallback(() => {
    if (!mapSecondaryDrilldownSpl) return;
    const url = splunkSearchAppUrl(
      mapSecondaryDrilldownSpl,
      timeRange,
      effectiveMapSecondaryCfg.dispatchContext,
    );
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }, [
    effectiveMapSecondaryCfg.dispatchContext,
    mapSecondaryDrilldownSpl,
    timeRange,
  ]);
  const mapPrimaryBindingFootnote = !mapPrimaryBaseCfg
    ? ""
    : mapPrimaryBaseRecord
      ? `Searchbase: ${mapPrimaryBaseRecord.searchName}`
      : mapPrimaryBaseCfg.searchbaseId
        ? `Searchbase id: ${mapPrimaryBaseCfg.searchbaseId}`
        : "(inline SPL)";
  const mapSecondaryBindingFootnote = !mapSecondaryBaseCfg
    ? ""
    : mapSecondaryBaseRecord
      ? `Searchbase: ${mapSecondaryBaseRecord.searchName}`
      : mapSecondaryBaseCfg.searchbaseId
        ? `Searchbase id: ${mapSecondaryBaseCfg.searchbaseId}`
        : "(inline SPL)";

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
    // Right now the only focusable input is the time-range select.
    // Once a global search bar is wired this is where it goes.
    const el = document.querySelector<HTMLSelectElement>(
      "select[data-shortcut-search]",
    );
    el?.focus();
  }, []);
  const openSignalTickerEditor = useCallback(() => {
    setSignalTickerEditorOpen(true);
  }, []);
  const closeHelp = useCallback(() => {
    setHelpOpen(false);
  }, []);

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
        handler: () => setHelpOpen((o) => !o),
      },
    ];
  }, [
    cycleTimeRange,
    effectiveSectionMeta,
    focusGlobalSearch,
    openDrilldown,
    openSignalTickerEditor,
    refreshNow,
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
  const inputClass =
    "text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-200 " +
    "dark:border-slate-700 rounded-md m-0 h-8 px-2 py-0 text-slate-700 dark:text-slate-200 " +
    "hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 " +
    "focus:ring-sky-500 cursor-pointer";
  const iconBtnClass =
    "p-1.5 rounded transition-colors text-slate-500 dark:text-slate-400 " +
    "hover:text-sky-600 dark:hover:text-sky-300 hover:bg-slate-50 dark:hover:bg-slate-800";

  return (
    <div
      ref={exportRef}
      style={dashboardShellStyle}
      className={cn(
        "scd-overview-page flex flex-col font-sans overflow-hidden",
        compactDensity && "scd-overview-compact",
        "bg-slate-50 text-slate-900",
        "dark:bg-slate-950 dark:text-slate-100",
        resolvedTheme === "dark" && "dark",
      )}
    >
      {/* Header */}
      <header className="h-14 flex-shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between shadow-sm">
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
        <div className="flex items-center gap-3 min-w-0 group/branding">
          <div className="w-9 h-9 bg-sky-600 rounded-lg flex items-center justify-center text-white overflow-hidden p-1 flex-shrink-0">
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
                if (
                  !brandingOverride.logoDataUri &&
                  logoSrc !== DEFAULT_LOGO_DATA_URI
                ) {
                  setLogoSrc(DEFAULT_LOGO_DATA_URI);
                }
              }}
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-black text-sky-900 dark:text-sky-200 tracking-tight leading-none uppercase truncate">
              {effectiveTitle}
            </h1>
            <p className="text-[9px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-[0.3em] mt-1 leading-none truncate">
              {effectiveSubtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setBrandingEditorOpen(true)}
            title="Edit branding (title, subtitle, logo)"
            aria-label="Edit branding (title, subtitle, logo)"
            className="flex-shrink-0 p-1 rounded text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800 opacity-0 group-hover/branding:opacity-100 focus-visible:opacity-100 transition"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2.5 flex-shrink-0">
          <HealthBadge statuses={statusList} />
          <label className="m-0 flex h-8 items-center gap-1.5">
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest hidden lg:inline">
              Range
            </span>
            <select
              data-shortcut-search
              value={timeRange.label}
              onChange={(e) => {
                const next = TIME_RANGE_OPTIONS.find(
                  (o) => o.label === e.target.value,
                );
                if (next) setTimeRange(next);
              }}
              className={inputClass}
            >
              {TIME_RANGE_OPTIONS.map((o) => (
                <option key={o.label} value={o.label}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="m-0 flex h-8 items-center gap-1.5">
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest hidden lg:inline">
              Auto
            </span>
            <select
              value={autoRefreshSeconds}
              onChange={(e) => setAutoRefreshSeconds(Number(e.target.value))}
              className={inputClass}
              title="Auto-refresh interval"
            >
              {AUTO_REFRESH_OPTIONS.map((o) => (
                <option key={o.seconds} value={o.seconds}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={refreshNow}
            title={`Refresh now (last: ${lastRefreshed.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })})`}
            className={iconBtnClass}
          >
            <RefreshCw
              className={
                "w-4 h-4 " + (autoRefreshSeconds > 0 ? "animate-pulse" : "")
              }
            />
          </button>
          <div className="relative group">
            <button
              type="button"
              disabled={exporting}
              className={cn(
                iconBtnClass,
                "disabled:opacity-50 disabled:cursor-wait",
              )}
              title="Export"
            >
              {exporting ? (
                <Pause className="w-4 h-4 animate-pulse" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </button>
            <div className="absolute right-0 top-full mt-1 hidden group-hover:flex group-focus-within:flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg overflow-hidden z-50 w-28">
              <button
                type="button"
                onClick={() => exportAs("png")}
                className="px-3 py-1.5 text-[11px] text-left font-semibold text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-slate-800"
              >
                Save as PNG
              </button>
              <button
                type="button"
                onClick={() => exportAs("pdf")}
                className="px-3 py-1.5 text-[11px] text-left font-semibold text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-slate-800 border-t border-slate-100 dark:border-slate-700"
              >
                Save as PDF
              </button>
            </div>
          </div>
          {overrideCount > 0 && (
            <button
              type="button"
              onClick={() => {
                if (
                  typeof window !== "undefined" &&
                  !window.confirm(
                    `Reset ${overrideCount} customised tile${
                      overrideCount === 1 ? "" : "s"
                    } to their default search bindings?`,
                  )
                ) {
                  return;
                }
                resetAllOverrides();
              }}
              title={`Reset ${overrideCount} customised tile${
                overrideCount === 1 ? "" : "s"
              }`}
              className={cn(
                iconBtnClass,
                "relative text-sky-600 dark:text-sky-300",
              )}
            >
              <RotateCcw className="w-4 h-4" />
              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] rounded-full bg-sky-500 text-white text-[9px] font-black leading-[14px] text-center px-0.5 border border-white dark:border-slate-900">
                {overrideCount}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setSignalTickerEditorOpen(true)}
            title={`Configure signal rail (${signalTickerItemCount} KPI${
              signalTickerItemCount === 1 ? "" : "s"
            })`}
            className={cn(
              iconBtnClass,
              signalTickerConfig.enabled
                ? "text-sky-600 dark:text-sky-300"
                : "text-slate-400 dark:text-slate-500",
            )}
          >
            <Sparkles className="w-4 h-4" />
          </button>
          <ThemeToggle theme={theme} onCycle={cycleTheme} />
          <button
            type="button"
            onClick={toggleMapVisibility}
            title={
              mapVisible
                ? "Hide customer site connectivity map"
                : "Show customer site connectivity map"
            }
            aria-label={
              mapVisible
                ? "Hide customer site connectivity map"
                : "Show customer site connectivity map"
            }
            aria-pressed={!mapVisible}
            className={cn(
              iconBtnClass,
              !mapVisible &&
                "text-sky-600 dark:text-sky-300 bg-sky-50 dark:bg-slate-800",
            )}
          >
            <MapIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            // Build 1205: title widened from "Keyboard
            // shortcuts" to reflect the overlay's broader
            // remit — it now also documents the picker's
            // scope contract (tile vs. section vs.
            // drill-down). The `?` shortcut still works
            // and is the affordance power users learned;
            // the title text is the discovery hook for
            // everyone else.
            title="Help & reference (?)"
            className={iconBtnClass}
          >
            <Keyboard className="w-4 h-4" />
          </button>
          {splunkUsername && (
            <div className="flex items-center gap-2">
              <div className="text-right hidden xl:block">
                <p
                  className="text-[11px] font-bold text-slate-700 dark:text-slate-200 leading-none max-w-[140px] truncate"
                  title={splunkUsername}
                >
                  {splunkUsername}
                </p>
                <div className="flex items-center justify-end gap-1 leading-tight">
                  <a
                    href={appCatalogUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[9px] text-slate-400 no-underline transition-colors hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                    title={`Installed: ${appVersionLabel} — click to review Splunk for Secure Networking and upgrades`}
                    aria-label={`Splunk for Secure Networking and upgrades; installed app ${appVersionLabel}`}
                  >
                    {appVersionLabel}
                  </a>
                  {appUpdateVersion && (
                    <a
                      href={appCatalogUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-full border border-amber-500 bg-amber-500 px-1.5 py-px text-[9px] font-semibold text-white no-underline transition-colors hover:border-amber-600 hover:bg-amber-600"
                      title={`A newer version, v${appUpdateVersion}, is available — open Manage Apps to upgrade`}
                      aria-label={`Update available: v${appUpdateVersion}. Open Manage Apps to upgrade`}
                    >
                      ⬆ v{appUpdateVersion}
                    </a>
                  )}
                </div>
              </div>
              <div
                className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-900/40 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-sky-600 dark:text-sky-300"
                title={`Signed in as ${splunkUsername}`}
              >
                <User className="w-4 h-4" />
              </div>
            </div>
          )}
        </div>
      </header>

      <SignalTickerRail
        config={signalTickerConfig}
        catalogueByName={searchbaseByName}
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
          className="group flex-shrink-0 relative block border-b border-sky-200 dark:border-sky-800/60 bg-white hover:bg-sky-50/80 dark:bg-slate-900 dark:hover:bg-sky-950/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-inset"
        >
          <div
            aria-hidden="true"
            className="absolute left-0 top-0 bottom-0 w-1 bg-sky-600 dark:bg-sky-500"
          />
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 pl-5 pr-4 py-2">
            <a
              href={featuredDrilldownHref}
              target="_blank"
              rel="noopener noreferrer"
              title={`Open ${selectedPriorityDrilldown.title} in a new tab`}
              aria-label={`Open ${selectedPriorityDrilldown.title} in a new tab`}
              className="min-w-0 h-7 flex items-center gap-3 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <div className="flex-shrink-0 w-7 h-7 rounded bg-sky-600 text-white flex items-center justify-center shadow-sm">
                <ClipboardCheck className="w-4 h-4 stroke-[2.5px]" />
              </div>
              <span className="text-[9px] font-black text-sky-700 dark:text-sky-300 uppercase tracking-[0.25em] whitespace-nowrap flex-shrink-0 hidden sm:inline w-[172px]">
                {PRIORITY_DRILLDOWN_LABEL}
              </span>
              <span className="text-[13px] font-bold text-slate-900 dark:text-slate-100 truncate min-w-0">
                {selectedPriorityDrilldown.title}
              </span>
              <span className="text-[11px] text-slate-600 dark:text-slate-400 truncate min-w-0 hidden lg:inline">
                {selectedPriorityDrilldown.description}
              </span>
            </a>
            <div className="flex items-center justify-end gap-2">
              <label className="hidden md:flex flex-shrink-0 items-center gap-1.5 h-7 !mb-0">
                <span className="sr-only">Priority drill-down dashboard</span>
                <Settings2
                  className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500"
                  aria-hidden="true"
                />
                <select
                  value={selectedPriorityDrilldown.viewName}
                  onChange={(e) =>
                    handlePriorityDrilldownChange(e.target.value)
                  }
                  title="Choose priority drill-down dashboard"
                  aria-label="Choose priority drill-down dashboard"
                  className="h-7 !mb-0 w-[220px] max-w-[22vw] rounded-md border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 px-2 py-0 text-[11px] leading-none font-semibold text-slate-700 dark:text-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
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
                className="h-7 flex-shrink-0 inline-flex items-center gap-1.5 px-3 rounded bg-sky-600 group-hover:bg-sky-500 active:bg-sky-700 text-white text-[11px] font-bold tracking-wide uppercase shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                {PRIORITY_DRILLDOWN_CTA}
                <ArrowRight className="w-3.5 h-3.5 stroke-[2.5px]" />
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
          "flex-1 min-h-0 w-full",
          isVerticalSplit
            ? "overflow-y-auto overflow-x-hidden"
            : "overflow-hidden",
          compactDensity ? "px-1 py-1.5" : "px-1.5 py-2",
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
            "scd-overview-split flex gap-2 h-full min-h-0 relative",
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
          <div
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
              "scd-overview-metrics flex flex-col gap-2 min-h-0 min-w-0 w-full overflow-y-auto overflow-x-hidden",
              mapVisible && mapPosition === "right"
                ? "xl:w-[var(--scd-left-pct)] xl:flex-shrink-0"
                : "",
            )}
            data-map-position={activeMapPosition}
            style={verticalMetricsStyle}
          >
            {visibleSections.map((section) => {
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
              const wrapTiles = visibleCount >= SECTION_WRAP_TILE_COUNT;
              const estimatedTileRows = wrapTiles
                ? Math.ceil(visibleCount / SECTION_WRAPPED_TILE_COLUMNS)
                : 1;
              const heightLevel =
                sectionHeights[section] ?? sectionHeightBounds.defaultLevel;
              const baseMinHeight = compactDensity
                ? SECTION_HEIGHT_COMPACT_BASE_PX
                : SECTION_HEIGHT_BASE_PX;
              const sectionMinHeight =
                baseMinHeight +
                (heightLevel - sectionHeightBounds.minLevel) *
                  SECTION_HEIGHT_STEP_PX +
                (estimatedTileRows - 1) * SECTION_WRAPPED_TILE_ROW_STEP_PX;

              // Apply the user's drag-reorder
              // preference (if any) to the canonical
              // tile list, then slice to the visible
              // count. The id-keyed `byId` lookup lets
              // the render iterate ordered ids while
              // still resolving each id back to its
              // full MetricConfig — no per-iteration
              // .find() scan.
              const canonicalIds = getFactoryTileOrder(
                section,
                allSectionMetrics,
              );
              const orderedIds = getSectionTileOrder(section, canonicalIds);
              const visibleIds = orderedIds.slice(0, visibleCount);
              const byId = new Map(allSectionMetrics.map((m) => [m.id, m]));

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
                  icon={meta.icon}
                  // Height level influences both
                  // proportional growth on roomy
                  // screens and the hard min-height
                  // floor that triggers metric-column
                  // scrolling on short screens.
                  style={{
                    flexGrow: heightLevel,
                    flexShrink: 0,
                    minHeight: sectionMinHeight,
                  }}
                  height={{
                    value: heightLevel,
                    min: sectionHeightBounds.minLevel,
                    max: sectionHeightBounds.maxLevel,
                    onChange: (next) => setSectionHeight(section, next),
                    label: `${meta.title} height`,
                  }}
                  wrapTiles={wrapTiles}
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
                            setSectionTileCount(section, next),
                          label: `${meta.title} tiles`,
                        }
                      : undefined
                  }
                  addTileAction={{
                    label: `Add search to ${meta.title}`,
                    title: `Add search to ${meta.title}`,
                    onClick: () => setAddTileSection(section),
                  }}
                  onEditTitle={() => setSectionTitlesEditorOpen(true)}
                >
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
                        <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50/70 px-4 text-center text-xs font-semibold text-slate-400 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-500">
                          No tiles configured.
                        </div>
                      )}
                      {visibleIds.map((id, idx) => {
                        const cfg = byId.get(id);
                        if (!cfg) return null;
                        const isLocalAddition = cfg.searchbaseId
                          ? locallyAddedSearchbaseIds.has(cfg.searchbaseId) &&
                            cfg.id ===
                              overviewAdditionTileId(section, cfg.searchbaseId)
                          : false;
                        return (
                          <SortableMetricCard
                            key={cfg.id}
                            id={cfg.id}
                            ariaLabel={cfg.label}
                            tileAction={{
                              label: isLocalAddition
                                ? `Remove ${cfg.label}`
                                : `Hide ${cfg.label}`,
                              title: isLocalAddition
                                ? `Remove added tile ${cfg.label}`
                                : `Hide ${cfg.label} from this overview`,
                              tone: isLocalAddition ? "remove" : "hide",
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
                                ? "min-w-[240px] md:min-w-[250px] min-h-[148px]"
                                : undefined
                            }
                          >
                            <MetricCard
                              cfg={cfg}
                              range={timeRange}
                              refreshToken={refreshToken}
                              onStatus={reportStatus}
                              // Anchor the tooltip to the right
                              // edge for the last metric so the
                              // popover stays inside the section
                              // card instead of overflowing.
                              infoAnchor={
                                idx === visibleIds.length - 1 ? "right" : "auto"
                              }
                              override={overrides[cfg.id]}
                              searchbaseByName={searchbaseByName}
                              searchbaseById={searchbaseById}
                              searchbaseDrilldowns={searchbaseDrilldowns}
                              compactDensity={compactDensity}
                              onOpenDetailTable={setActiveDetailTable}
                              onConfigure={() =>
                                openPicker(cfg.id, cfg.label, {
                                  savedSearch: cfg.savedSearch,
                                  valueField: cfg.valueField,
                                  defaultThresholds: cfg.thresholds,
                                  unit: cfg.unit,
                                  section: cfg.section,
                                })
                              }
                            />
                          </SortableMetricCard>
                        );
                      })}
                    </SortableContext>
                  </DndContext>
                </DashboardSection>
              );
            })}
          </div>

          {/* Splitter handle — renders in every layout mode.
                        Right mode: thin vertical bar visible at xl+,
                        hidden on smaller widths where the layout
                        collapses to a single stacked column anyway.
                        Below/above modes: thin horizontal bar always
                        visible, spanning the full width. 6-8px hit-
                        area so it's easy to grab without being
                        visually heavy. Drag along the splitter's
                        short axis to rebalance tiles ↔ map; arrow
                        keys nudge ±1% (Shift = ±5%); Home/End jump to
                        the limits; double-click restores the default
                        split. Same `leftPct` persists across modes so
                        switching back to a previous orientation
                        preserves the user's intent. */}
          {mapVisible && (
            <button
              type="button"
              role="separator"
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
                "scd-overview-splitter flex flex-shrink-0 items-center justify-center group relative",
                "rounded-full transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400",
                // Right mode hides the splitter on sub-xl
                // widths because the layout collapses to a
                // single column there. Vertical modes
                // never collapse, so the splitter is
                // always visible in those.
                mapPosition === "right" && "hidden xl:flex",
                isVerticalSplit
                  ? "h-1.5 my-0.5 w-full cursor-row-resize"
                  : "w-1.5 mx-0.5 cursor-col-resize",
                dragging
                  ? "bg-sky-500"
                  : "bg-slate-200 dark:bg-slate-700 hover:bg-sky-400 dark:hover:bg-sky-500",
              )}
              data-map-position={mapPosition}
            >
              {/* Visible grip dots — three subtle dashes,
                                oriented perpendicular to the drag axis so
                                they read as a grip handle. Helps signal
                                the handle is interactive at a glance. */}
              <span
                aria-hidden="true"
                className={cn(
                  "flex gap-0.5 opacity-50 transition-opacity",
                  isVerticalSplit ? "flex-row" : "flex-col",
                  dragging ? "opacity-100" : "group-hover:opacity-90",
                )}
              >
                <span
                  className={cn(
                    "block rounded-full bg-white",
                    isVerticalSplit ? "h-0.5 w-1" : "w-0.5 h-1",
                  )}
                />
                <span
                  className={cn(
                    "block rounded-full bg-white",
                    isVerticalSplit ? "h-0.5 w-1" : "w-0.5 h-1",
                  )}
                />
                <span
                  className={cn(
                    "block rounded-full bg-white",
                    isVerticalSplit ? "h-0.5 w-1" : "w-0.5 h-1",
                  )}
                />
              </span>
            </button>
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
              style={verticalMapStyle}
            >
              <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-3 shadow-sm flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-2 flex-shrink-0">
                  <div>
                    <h3 className="text-base font-bold text-sky-900 dark:text-sky-200 uppercase tracking-wide leading-none">
                      {topologyHeaderName}
                    </h3>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                      {topologyHeaderSubtitle}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPositionToggle
                      value={mapPosition}
                      onChange={setMapPosition}
                    />
                    <RegionalViewToggle
                      value={regionalView}
                      onChange={setRegionalView}
                    />
                  </div>
                </div>

                <div className="flex-1 min-h-0">
                  {regionalView === "map" ? (
                    /* Build 1190 — render the live map
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
                                       future. */
                    <CustomerTopologyMap
                      key={topologyResetKey}
                      topology={CUSTOMER_TOPOLOGY}
                      isDark={resolvedTheme === "dark"}
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
                  ) : (
                    <TopologySiteTable topology={CUSTOMER_TOPOLOGY} />
                  )}
                </div>

                {mapPrimaryBaseCfg || mapSecondaryBaseCfg ? (
                  <div className="mt-3 grid grid-cols-2 gap-3 flex-shrink-0">
                    {mapPrimaryBaseCfg ? (
                      <KpiCard
                        label={effectiveMapPrimaryCfg.label}
                        value={mapPrimary.value}
                        source={mapPrimary.source}
                        accentClassName="bg-emerald-500"
                        description={mapPrimaryBaseCfg.description}
                        thresholdNote={mapPrimaryBaseCfg.thresholdNote}
                        bindingFootnote={mapPrimaryBindingFootnote}
                        onOpenInSearch={
                          mapPrimaryDrilldownSpl
                            ? handleMapPrimaryOpenInSearch
                            : undefined
                        }
                        onConfigure={() =>
                          openPicker(
                            mapPrimaryBaseCfg.id,
                            mapPrimaryBaseCfg.label,
                            {
                              savedSearch: mapPrimaryBaseCfg.savedSearch,
                              valueField: mapPrimaryBaseCfg.valueField,
                              unit: mapPrimaryBaseCfg.unit,
                            },
                          )
                        }
                        isCustomized={Boolean(mapPrimaryOverride)}
                      />
                    ) : null}
                    {mapSecondaryBaseCfg ? (
                      <KpiCard
                        label={effectiveMapSecondaryCfg.label}
                        value={mapSecondary.value}
                        source={mapSecondary.source}
                        accentClassName="bg-sky-500"
                        description={mapSecondaryBaseCfg.description}
                        thresholdNote={mapSecondaryBaseCfg.thresholdNote}
                        bindingFootnote={mapSecondaryBindingFootnote}
                        onOpenInSearch={
                          mapSecondaryDrilldownSpl
                            ? handleMapSecondaryOpenInSearch
                            : undefined
                        }
                        onConfigure={() =>
                          openPicker(
                            mapSecondaryBaseCfg.id,
                            mapSecondaryBaseCfg.label,
                            {
                              savedSearch: mapSecondaryBaseCfg.savedSearch,
                              valueField: mapSecondaryBaseCfg.valueField,
                              unit: mapSecondaryBaseCfg.unit,
                            },
                          )
                        }
                        isCustomized={Boolean(mapSecondaryOverride)}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="flex-shrink-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-1 text-center text-[8.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] leading-none">
        Splunk Field Solutions - Executive Insights
      </footer>

      <HelpOverlay
        open={helpOpen}
        onClose={closeHelp}
        shortcuts={helpShortcutRows}
      />

      {addTilePickerState && (
        <OverviewAddTilePanel
          open={addTileSection !== null}
          profile={overviewProfile}
          section={addTilePickerState.section}
          sectionTitle={addTilePickerState.sectionTitle}
          records={searchbaseRecords ?? []}
          loading={searchbaseRecords === null}
          currentSearchbaseIds={addTilePickerState.currentSearchbaseIds}
          hiddenSearchbaseIds={addTilePickerState.hiddenSearchbaseIds}
          locallyAddedSearchbaseIds={
            addTilePickerState.locallyAddedSearchbaseIds
          }
          currentTileCount={addTilePickerState.currentTileCount}
          currentVisibleCount={addTilePickerState.currentVisibleCount}
          maxTileCount={sectionTileBounds.maxCount}
          onAdd={(record) =>
            handleAddSearchToSection(addTilePickerState.section, record)
          }
          onRemove={(record) =>
            handleRemoveAddedSearchFromSection(
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
        onSaveFactoryDefaults={handleSaveOverviewFactoryDefaults}
        factoryDefaultsStatus={factoryDefaultsStatus}
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
        override={brandingOverride}
        titlePlaceholder={
          overviewProfile.headerTitle ||
          customerName ||
          DEFAULT_HEADER_TITLE_FALLBACK
        }
        subtitlePlaceholder={
          overviewProfile.headerSubtitle || DEFAULT_HEADER_SUBTITLE
        }
        logoFallbackSrc={logoSrc}
        onSave={(next) => setBrandingOverride(next)}
        onResetToDefaults={() => {
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
const DEFAULT_ADD_TILE_APP_SCOPE = "splunk-cisco-dashboards";
const ADD_TILE_TAG_CHIP_LIMIT = 24;

const makeDefaultAddTileAppSelection = (): Set<string> =>
  new Set([DEFAULT_ADD_TILE_APP_SCOPE]);

const isDefaultAddTileAppSelection = (
  selection: ReadonlySet<string>,
): boolean => selection.size === 1 && selection.has(DEFAULT_ADD_TILE_APP_SCOPE);

const recordMatchesAddTileAppSelection = (
  record: SearchbaseRecord,
  selection: ReadonlySet<string>,
): boolean => selection.size === 0 || selection.has(record.dispatchContext);

const recordHasTag = (record: SearchbaseRecord, tagName: string): boolean =>
  record.tags.some((tag) => tag.toLowerCase() === tagName.toLowerCase());

const recordMatchesProfileScope = (
  record: SearchbaseRecord,
  profile: OverviewProfile,
): boolean => {
  if (!record.search?.trim()) return false;
  const requiredTag = profile.autoDiscovery?.requiredTag;
  return requiredTag ? recordHasTag(record, requiredTag) : true;
};

const recordMatchesProfileSection = (
  record: SearchbaseRecord,
  profile: OverviewProfile,
  section: SectionId,
): boolean => {
  const explicitOverviewMatch = overviewDefinitionsFromRecord(record).some(
    (definition) =>
      parseOverviewProfile(definition.profile) === profile.id &&
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

interface OverviewAddTileAppMultiSelectProps {
  apps: string[];
  appCountByName: ReadonlyMap<string, number>;
  selectedApps: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
}

const OverviewAddTileAppMultiSelect: React.FC<
  OverviewAddTileAppMultiSelectProps
> = ({ apps, appCountByName, selectedApps, onChange }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isAllApps = selectedApps.size === 0;
  const appOptions = useMemo(() => {
    const set = new Set(apps);
    if (!set.has(DEFAULT_ADD_TILE_APP_SCOPE)) {
      set.add(DEFAULT_ADD_TILE_APP_SCOPE);
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [apps]);
  const selectedList = appOptions.filter((app) => selectedApps.has(app));

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggleApp = (app: string) => {
    const next = new Set<string>(isAllApps ? [] : selectedApps);
    if (next.has(app)) {
      next.delete(app);
    } else {
      next.add(app);
    }
    onChange(next);
  };

  const removeApp = (app: string) => {
    const next = new Set<string>(selectedApps);
    next.delete(app);
    onChange(next);
  };

  return (
    <div className="relative min-w-0" ref={containerRef}>
      <div
        role="combobox"
        aria-label="Filter searches by app"
        aria-controls="overview-add-search-app-filter-options"
        aria-expanded={open}
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={cn(
          "flex min-h-[42px] w-full cursor-pointer flex-wrap items-center gap-1 rounded-lg border bg-white px-2 py-1.5 text-sm transition-shadow dark:bg-slate-950",
          open
            ? "border-sky-400 ring-2 ring-sky-400/25"
            : "border-slate-200 dark:border-slate-800",
        )}
      >
        {isAllApps ? (
          <span className="min-w-0 flex-1 truncate font-semibold text-slate-700 dark:text-slate-100">
            All apps ({appOptions.length})
          </span>
        ) : (
          selectedList.map((app) => {
            const count = appCountByName.get(app) ?? 0;
            return (
              <span
                key={app}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-sky-500 py-0.5 pl-2 pr-1 text-[10px] font-bold uppercase tracking-wide text-white"
              >
                <span className="max-w-[220px] truncate">{app}</span>
                {count > 0 && (
                  <span className="font-normal opacity-75">{count}</span>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeApp(app);
                  }}
                  title={`Remove ${app} app filter`}
                  aria-label={`Remove ${app} app filter`}
                  className="rounded-full p-0.5 hover:bg-sky-700/40"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            );
          })
        )}
        {!isAllApps && selectedList.length === 0 && (
          <span className="min-w-0 flex-1 truncate font-semibold text-slate-500 dark:text-slate-400">
            No matching apps selected
          </span>
        )}
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-slate-400" />
      </div>

      {open && (
        <div
          id="overview-add-search-app-filter-options"
          role="listbox"
          aria-label="Filter searches by app"
          aria-multiselectable="true"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
        >
          <button
            type="button"
            role="option"
            aria-selected={isAllApps}
            onClick={() => onChange(new Set())}
            className={cn(
              "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs transition-colors focus:outline-none",
              isAllApps
                ? "bg-sky-50 dark:bg-sky-900/30"
                : "hover:bg-sky-50 dark:hover:bg-sky-900/30",
            )}
          >
            <span className="flex min-w-0 items-center gap-2 truncate font-semibold text-slate-700 dark:text-slate-200">
              <span
                className={cn(
                  "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border",
                  isAllApps
                    ? "border-sky-500 bg-sky-500 text-white"
                    : "border-slate-300 dark:border-slate-700",
                )}
              >
                {isAllApps && <Check className="h-3 w-3" />}
              </span>
              <span className="truncate">All apps</span>
            </span>
            <span className="shrink-0 text-[10px] font-bold text-slate-400 dark:text-slate-500">
              {appOptions.length}
            </span>
          </button>
          {appOptions.map((app) => {
            const selected = selectedApps.has(app);
            const count = appCountByName.get(app) ?? 0;
            return (
              <button
                key={app}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => toggleApp(app)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs transition-colors focus:outline-none",
                  selected
                    ? "bg-sky-50 dark:bg-sky-900/30"
                    : "hover:bg-sky-50 dark:hover:bg-sky-900/30",
                )}
              >
                <span className="flex min-w-0 items-center gap-2 truncate text-slate-700 dark:text-slate-200">
                  <span
                    className={cn(
                      "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border",
                      selected
                        ? "border-sky-500 bg-sky-500 text-white"
                        : "border-slate-300 dark:border-slate-700",
                    )}
                  >
                    {selected && <Check className="h-3 w-3" />}
                  </span>
                  <span className="truncate">{app}</span>
                </span>
                <span className="shrink-0 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface OverviewAddTilePanelProps {
  open: boolean;
  profile: OverviewProfile;
  section: SectionId;
  sectionTitle: string;
  records: SearchbaseRecord[];
  loading: boolean;
  currentSearchbaseIds: ReadonlySet<string>;
  hiddenSearchbaseIds: ReadonlySet<string>;
  locallyAddedSearchbaseIds: ReadonlySet<string>;
  currentTileCount: number;
  currentVisibleCount: number;
  maxTileCount: number;
  onAdd: (record: SearchbaseRecord) => void;
  onRemove: (record: SearchbaseRecord) => void;
  onUnhide: (record: SearchbaseRecord) => void;
  onClose: () => void;
}

const OverviewAddTilePanel: React.FC<OverviewAddTilePanelProps> = ({
  open,
  profile,
  section,
  sectionTitle,
  records,
  loading,
  currentSearchbaseIds,
  hiddenSearchbaseIds,
  locallyAddedSearchbaseIds,
  currentTileCount,
  currentVisibleCount,
  maxTileCount,
  onAdd,
  onRemove,
  onUnhide,
  onClose,
}) => {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(
    ALL_ADD_TILE_CATEGORIES,
  );
  const [selectedSubCategory, setSelectedSubCategory] = useState(
    ALL_ADD_TILE_SUB_CATEGORIES,
  );
  const [selectedApps, setSelectedApps] = useState<Set<string>>(
    makeDefaultAddTileAppSelection,
  );
  const [includeHiddenSearches, setIncludeHiddenSearches] = useState(false);
  const [includeDrilldownSearches, setIncludeDrilldownSearches] =
    useState(false);
  const [includeTableSearches, setIncludeTableSearches] = useState(false);
  const [activeTags, setActiveTags] = useState<Set<string>>(() => new Set());
  const [tagFilter, setTagFilter] = useState("");
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showAllProfileSearches, setShowAllProfileSearches] = useState(true);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const tagSelectRef = useRef<HTMLDivElement | null>(null);
  const tagInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelectedCategory(ALL_ADD_TILE_CATEGORIES);
    setSelectedSubCategory(ALL_ADD_TILE_SUB_CATEGORIES);
    setSelectedApps(makeDefaultAddTileAppSelection());
    setIncludeHiddenSearches(false);
    setIncludeDrilldownSearches(false);
    setIncludeTableSearches(false);
    setActiveTags(new Set());
    setTagFilter("");
    setTagDropdownOpen(false);
    setFiltersOpen(false);
    setShowAllProfileSearches(true);
    if (typeof window === "undefined") return;
    const id = window.setTimeout(() => searchInputRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [open, profile.id, section]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !tagDropdownOpen) return undefined;
    const handler = (e: MouseEvent) => {
      if (!tagSelectRef.current?.contains(e.target as Node)) {
        setTagDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, tagDropdownOpen]);

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
      addableRecords.filter((record) =>
        recordMatchesProfileScope(record, profile),
      ),
    [addableRecords, profile],
  );

  const drilldownSearchNames = useMemo(() => {
    const names = new Set<string>();
    for (const record of addableRecords) {
      const name = record.drilldownSearchName?.trim();
      if (name) names.add(name.toLowerCase());
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

  const suggestedRecords =
    sectionRecords.length > 0 ? sectionRecords : profileRecords;
  const browseRecords = showAllProfileSearches
    ? addableRecords
    : suggestedRecords;
  const showScopeToggle =
    suggestedRecords.length > 0 &&
    addableRecords.length > suggestedRecords.length;

  const browseVisibleRecords = useMemo(() => {
    return browseRecords.filter((record) => {
      if (
        !includeHiddenSearches &&
        (record.searchHidden || hiddenSearchbaseIds.has(record.id))
      ) {
        return false;
      }
      if (!recordMatchesAddTileAppSelection(record, selectedApps)) {
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
    hiddenSearchbaseIds,
    includeDrilldownSearches,
    includeHiddenSearches,
    includeTableSearches,
    selectedApps,
  ]);

  const appFacetRecords = useMemo(
    () =>
      addableRecords.filter(
        (record) =>
          includeHiddenSearches ||
          !(record.searchHidden || hiddenSearchbaseIds.has(record.id)),
      ),
    [addableRecords, hiddenSearchbaseIds, includeHiddenSearches],
  );

  const apps = useMemo(() => {
    const set = new Set<string>();
    for (const record of appFacetRecords) {
      if (record.dispatchContext) set.add(record.dispatchContext);
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [appFacetRecords]);

  const appCountByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const record of appFacetRecords) {
      if (record.dispatchContext) {
        map.set(
          record.dispatchContext,
          (map.get(record.dispatchContext) ?? 0) + 1,
        );
      }
    }
    return map;
  }, [appFacetRecords]);

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

  useEffect(() => {
    if (
      !showAllProfileSearches ||
      !isDefaultAddTileAppSelection(selectedApps) ||
      includeHiddenSearches ||
      includeDrilldownSearches ||
      includeTableSearches ||
      selectedCategory !== ALL_ADD_TILE_CATEGORIES ||
      selectedSubCategory !== ALL_ADD_TILE_SUB_CATEGORIES ||
      activeTags.size > 0
    ) {
      setFiltersOpen(true);
    }
  }, [
    activeTags,
    includeDrilldownSearches,
    includeHiddenSearches,
    includeTableSearches,
    selectedApps,
    selectedCategory,
    selectedSubCategory,
    showAllProfileSearches,
  ]);

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

  const tagDropdownOptions = useMemo(() => {
    const filter = tagFilter.trim().toLowerCase();
    const available = allTagsWithCounts.filter(([tag]) => !activeTags.has(tag));
    if (!filter) return available.slice(0, ADD_TILE_TAG_CHIP_LIMIT);
    return available.filter(([tag]) => tag.toLowerCase().includes(filter));
  }, [activeTags, allTagsWithCounts, tagFilter]);

  const tagCountByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const [tag, count] of allTagsWithCounts) map.set(tag, count);
    return map;
  }, [allTagsWithCounts]);

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

  const addTag = (tag: string) => {
    setActiveTags((prev) => {
      if (prev.has(tag)) return prev;
      const next = new Set(prev);
      next.add(tag);
      return next;
    });
    setTagFilter("");
    tagInputRef.current?.focus();
  };

  const removeTag = (tag: string) => {
    setActiveTags((prev) => {
      if (!prev.has(tag)) return prev;
      const next = new Set(prev);
      next.delete(tag);
      return next;
    });
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && tagFilter === "" && activeTags.size > 0) {
      const arr = Array.from(activeTags);
      removeTag(arr[arr.length - 1]);
    } else if (e.key === "Escape") {
      setTagDropdownOpen(false);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (tagDropdownOptions.length > 0) addTag(tagDropdownOptions[0][0]);
    } else if (e.key === "ArrowDown" && !tagDropdownOpen) {
      setTagDropdownOpen(true);
    }
  };

  const activeFilterCount =
    (!showAllProfileSearches ? 1 : 0) +
    (!isDefaultAddTileAppSelection(selectedApps) ? 1 : 0) +
    (includeHiddenSearches ? 1 : 0) +
    (includeDrilldownSearches ? 1 : 0) +
    (includeTableSearches ? 1 : 0) +
    (selectedCategory !== ALL_ADD_TILE_CATEGORIES ? 1 : 0) +
    (selectedSubCategory !== ALL_ADD_TILE_SUB_CATEGORIES ? 1 : 0) +
    activeTags.size;
  const facetsActive = activeFilterCount > 0 || tagFilter.trim().length > 0;
  const availableSearchLabel = `${filteredRecords.length.toLocaleString()} ${
    filteredRecords.length === 1 ? "search" : "searches"
  } available`;

  const handleClearFacets = () => {
    setSelectedApps(makeDefaultAddTileAppSelection());
    setIncludeHiddenSearches(false);
    setIncludeDrilldownSearches(false);
    setIncludeTableSearches(false);
    setSelectedCategory(ALL_ADD_TILE_CATEGORIES);
    setSelectedSubCategory(ALL_ADD_TILE_SUB_CATEGORIES);
    setActiveTags(new Set());
    setTagFilter("");
    setShowAllProfileSearches(true);
  };

  if (!open) return null;

  const atVisibleMax = currentVisibleCount >= maxTileCount;
  const countLabel = `${currentVisibleCount}/${maxTileCount} visible`;

  return (
    <>
      <div
        className="fixed inset-0 z-[1500] bg-slate-950/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Add search to ${sectionTitle}`}
        className="fixed top-0 right-0 z-[1600] h-full w-full max-w-[calc(100vw-12px)] border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:w-[500px] xl:w-[540px] flex flex-col"
      >
        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Add search
            </p>
            <p className="truncate text-sm font-black text-slate-800 dark:text-slate-100">
              {sectionTitle}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              title={`${currentVisibleCount} visible, ${currentTileCount} configured, maximum ${maxTileCount}`}
              className={cn(
                "rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-wider",
                atVisibleMax
                  ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200"
                  : "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/50 dark:text-sky-200",
              )}
            >
              {countLabel}
            </span>
            <button
              type="button"
              onClick={onClose}
              title="Close (Esc)"
              aria-label="Close add search panel"
              className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-shrink-0 space-y-2 px-4 py-3">
          <label className="relative block">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name, description, or tag..."
              maxLength={120}
              className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-8 pr-2.5 text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen((o) => !o)}
              aria-expanded={filtersOpen}
              aria-controls="overview-add-search-filters"
              title={
                filtersOpen
                  ? "Hide filters"
                  : "Show filters (App, Visibility, Category, Sub-cat, Tags)"
              }
              className="flex items-center gap-1.5 rounded px-1.5 py-1 -ml-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100"
            >
              {filtersOpen ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span
                  className="ml-1 rounded-full bg-sky-100 px-1.5 py-px text-[9px] font-semibold normal-case tracking-normal text-sky-700 dark:bg-sky-900/50 dark:text-sky-300"
                  title={`${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}`}
                >
                  {activeFilterCount} active
                </span>
              )}
            </button>
            <div className="flex items-center gap-2">
              <span
                title="Searchbase stanzas matching the current app, visibility, category, sub-category, tag, scope, and text filters"
                className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-sky-700 shadow-sm dark:border-sky-900/70 dark:bg-sky-950/50 dark:text-sky-200"
              >
                {availableSearchLabel}
              </span>
              {facetsActive && (
                <button
                  type="button"
                  onClick={handleClearFacets}
                  title="Reset every filter to its default"
                  className="text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {filtersOpen && (
            <div
              id="overview-add-search-filters"
              className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/50"
            >
              {showScopeToggle && (
                <div className="grid gap-1 sm:grid-cols-[82px_minmax(0,1fr)] sm:items-center">
                  <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Scope
                  </span>
                  <div
                    className="inline-flex w-fit rounded-md border border-slate-200 bg-white p-0.5 dark:border-slate-800 dark:bg-slate-950"
                    role="group"
                    aria-label="Search scope"
                  >
                    <button
                      type="button"
                      onClick={() => setShowAllProfileSearches(false)}
                      className={cn(
                        "rounded px-2 py-1 text-[10px] font-black uppercase tracking-wider transition-colors",
                        !showAllProfileSearches
                          ? "bg-sky-50 text-sky-700 shadow-sm dark:bg-sky-950/50 dark:text-sky-200"
                          : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100",
                      )}
                    >
                      Suggested
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAllProfileSearches(true)}
                      className={cn(
                        "rounded px-2 py-1 text-[10px] font-black uppercase tracking-wider transition-colors",
                        showAllProfileSearches
                          ? "bg-sky-50 text-sky-700 shadow-sm dark:bg-sky-950/50 dark:text-sky-200"
                          : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100",
                      )}
                    >
                      All searches
                    </button>
                  </div>
                </div>
              )}

              <div className="grid gap-1 sm:grid-cols-[82px_minmax(0,1fr)] sm:items-center">
                <span
                  className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400"
                  title="Splunk app the search dispatches in"
                >
                  App
                </span>
                <OverviewAddTileAppMultiSelect
                  apps={apps}
                  appCountByName={appCountByName}
                  selectedApps={selectedApps}
                  onChange={setSelectedApps}
                />
              </div>

              <div className="grid gap-1 sm:grid-cols-[82px_minmax(0,1fr)] sm:items-start">
                <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Visibility
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <label className="flex min-h-[58px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-bold leading-snug text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
                    <input
                      type="checkbox"
                      checked={includeHiddenSearches}
                      onChange={(e) =>
                        setIncludeHiddenSearches(e.target.checked)
                      }
                      className="h-4 w-4 shrink-0 rounded border-slate-300 text-sky-600 focus:ring-sky-400 dark:border-slate-700 dark:bg-slate-900"
                    />
                    <span>Show hidden searches</span>
                  </label>
                  <label className="flex min-h-[58px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-bold leading-snug text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
                    <input
                      type="checkbox"
                      checked={includeDrilldownSearches}
                      onChange={(e) =>
                        setIncludeDrilldownSearches(e.target.checked)
                      }
                      className="h-4 w-4 shrink-0 rounded border-slate-300 text-sky-600 focus:ring-sky-400 dark:border-slate-700 dark:bg-slate-900"
                    />
                    <span>Show drill-down searches</span>
                  </label>
                  <label className="flex min-h-[58px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-bold leading-snug text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
                    <input
                      type="checkbox"
                      checked={includeTableSearches}
                      onChange={(e) =>
                        setIncludeTableSearches(e.target.checked)
                      }
                      className="h-4 w-4 shrink-0 rounded border-slate-300 text-sky-600 focus:ring-sky-400 dark:border-slate-700 dark:bg-slate-900"
                    />
                    <span>Show table searches</span>
                  </label>
                </div>
              </div>

              {categories.length > 0 && (
                <label className="grid gap-1 sm:grid-cols-[82px_minmax(0,1fr)] sm:items-center">
                  <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Category
                  </span>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    aria-label="Filter searches by category"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-950"
                  >
                    <option value={ALL_ADD_TILE_CATEGORIES}>
                      All categories
                    </option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {selectedCategory !== ALL_ADD_TILE_CATEGORIES &&
                subCategories.length > 0 && (
                  <label className="grid gap-1 sm:grid-cols-[82px_minmax(0,1fr)] sm:items-center">
                    <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                      Sub-cat
                    </span>
                    <select
                      value={selectedSubCategory}
                      onChange={(e) => setSelectedSubCategory(e.target.value)}
                      aria-label="Filter searches by sub-category"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-950"
                    >
                      <option value={ALL_ADD_TILE_SUB_CATEGORIES}>
                        All sub-categories ({subCategories.length})
                      </option>
                      {subCategories.map((subCategory) => (
                        <option key={subCategory} value={subCategory}>
                          {subCategory}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

              {(allTagsWithCounts.length > 0 || activeTags.size > 0) && (
                <div className="grid gap-1 sm:grid-cols-[82px_minmax(0,1fr)] sm:items-start">
                  <span className="pt-2 text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Tags
                  </span>
                  <div className="relative" ref={tagSelectRef}>
                    <div
                      onClick={() => {
                        setTagDropdownOpen(true);
                        tagInputRef.current?.focus();
                      }}
                      className={cn(
                        "flex min-h-[42px] cursor-text flex-wrap items-center gap-1 rounded-lg border bg-white px-2 py-1.5 transition-shadow dark:bg-slate-950",
                        tagDropdownOpen
                          ? "border-sky-400 ring-2 ring-sky-400/25"
                          : "border-slate-200 dark:border-slate-800",
                      )}
                    >
                      <Tag className="ml-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                      {Array.from(activeTags).map((tag) => {
                        const count = tagCountByName.get(tag) ?? 0;
                        return (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 rounded-full bg-sky-500 py-0.5 pl-2 pr-1 text-[10px] font-bold uppercase tracking-wide text-white"
                          >
                            {tag}
                            {count > 0 && (
                              <span className="font-normal opacity-75">
                                {count}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeTag(tag);
                              }}
                              title={`Remove ${tag} filter`}
                              aria-label={`Remove ${tag} filter`}
                              className="rounded-full p-0.5 hover:bg-sky-700/40"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </span>
                        );
                      })}
                      <input
                        ref={tagInputRef}
                        type="text"
                        value={tagFilter}
                        onChange={(e) => {
                          setTagFilter(e.target.value);
                          setTagDropdownOpen(true);
                        }}
                        onFocus={() => setTagDropdownOpen(true)}
                        onKeyDown={handleTagInputKeyDown}
                        placeholder={
                          activeTags.size === 0
                            ? `Filter by tag (${allTagsWithCounts.length} tags available, AND combined)...`
                            : "Add tag..."
                        }
                        maxLength={64}
                        aria-label="Filter results by tag"
                        className="min-w-[120px] flex-1 border-0 bg-transparent py-1 text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100"
                      />
                    </div>

                    {tagDropdownOpen && (
                      <div
                        role="listbox"
                        aria-label="Available tags"
                        className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
                      >
                        {tagDropdownOptions.length === 0 ? (
                          <p className="px-3 py-2 text-xs italic text-slate-400 dark:text-slate-500">
                            {tagFilter.trim()
                              ? `No more tags match "${tagFilter.trim()}".`
                              : activeTags.size > 0
                                ? "All available tags already selected."
                                : "No tags available in this slice."}
                          </p>
                        ) : (
                          <>
                            {tagDropdownOptions.map(([tag, count], idx) => {
                              const isFirstTyped =
                                idx === 0 && Boolean(tagFilter.trim());
                              return (
                                <button
                                  key={tag}
                                  type="button"
                                  role="option"
                                  aria-selected={isFirstTyped}
                                  onClick={() => addTag(tag)}
                                  title={`${count} search${count === 1 ? "" : "es"} tagged ${tag}`}
                                  className={cn(
                                    "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs transition-colors focus:outline-none",
                                    isFirstTyped
                                      ? "bg-sky-50 dark:bg-sky-900/30"
                                      : "hover:bg-sky-50 dark:hover:bg-sky-900/30",
                                  )}
                                >
                                  <span className="flex min-w-0 items-center gap-1.5 truncate text-slate-700 dark:text-slate-200">
                                    <Tag className="h-3 w-3 shrink-0 text-slate-400" />
                                    <span className="truncate">{tag}</span>
                                  </span>
                                  <span className="shrink-0 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                                    {count}
                                  </span>
                                </button>
                              );
                            })}
                            {!tagFilter.trim() &&
                              allTagsWithCounts.length - activeTags.size >
                                tagDropdownOptions.length && (
                                <p className="border-t border-slate-100 px-3 py-1.5 text-[10px] text-slate-400 dark:border-slate-800 dark:text-slate-500">
                                  Top {tagDropdownOptions.length} of{" "}
                                  {allTagsWithCounts.length - activeTags.size} -
                                  type to filter.
                                </p>
                              )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-3 pb-3">
          {loading && (
            <div className="px-3 py-8 text-center text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Loading searchbase.conf
            </div>
          )}
          {!loading && filteredRecords.length === 0 && (
            <div className="px-3 py-8 text-center text-xs font-semibold text-slate-400 dark:text-slate-500">
              No searches match the current filters.
            </div>
          )}
          {!loading &&
            filteredRecords.map((record) => {
              const alreadyInSection = currentSearchbaseIds.has(record.id);
              const hiddenInSection = hiddenSearchbaseIds.has(record.id);
              const locallyAdded = locallyAddedSearchbaseIds.has(record.id);
              const disabled = alreadyInSection && !hiddenInSection;
              const description =
                plainTextFromHtml(record.explanation) ??
                plainTextFromHtml(record.description);
              const tags = record.tags.slice(0, 3);
              return (
                <div
                  key={record.id}
                  className={cn(
                    "mb-2 rounded-lg border p-3 transition-colors",
                    hiddenInSection
                      ? "border-amber-200 bg-amber-50/70 dark:border-amber-900/70 dark:bg-amber-950/30"
                      : alreadyInSection
                        ? "border-sky-200 bg-sky-50/70 dark:border-sky-900/70 dark:bg-sky-950/30"
                        : "border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50/40 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-sky-900/70 dark:hover:bg-sky-950/20",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <p
                          className="truncate text-[12px] font-black text-slate-800 dark:text-slate-100"
                          title={record.searchName}
                        >
                          {record.searchName}
                        </p>
                        {hiddenInSection ? (
                          <EyeOff className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300" />
                        ) : alreadyInSection ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-300" />
                        ) : null}
                        {record.searchHidden && (
                          <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                            Hidden
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        {[record.category, record.subCategory]
                          .filter(Boolean)
                          .join(" / ") || record.id}
                      </p>
                      {description && (
                        <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                          {description}
                        </p>
                      )}
                      {tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {hiddenInSection ? (
                      <button
                        type="button"
                        onClick={() => onUnhide(record)}
                        title={`Show ${record.searchName} in ${sectionTitle}`}
                        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md bg-amber-500 px-2 text-[10px] font-black uppercase tracking-wider text-white transition-colors hover:bg-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Show
                      </button>
                    ) : locallyAdded ? (
                      <button
                        type="button"
                        onClick={() => onRemove(record)}
                        title={`Remove ${record.searchName} from ${sectionTitle}`}
                        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-red-200 bg-white px-2 text-[10px] font-black uppercase tracking-wider text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 dark:border-red-900/70 dark:bg-slate-950 dark:text-red-300 dark:hover:bg-red-950/30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onAdd(record)}
                        disabled={disabled}
                        title={
                          alreadyInSection
                            ? "Already in this section"
                            : atVisibleMax
                              ? `Add ${record.searchName} as the last visible tile`
                              : `Add ${record.searchName}`
                        }
                        className={cn(
                          "inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-[10px] font-black uppercase tracking-wider transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400",
                          disabled
                            ? "cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                            : "bg-sky-600 text-white hover:bg-sky-500 active:bg-sky-700",
                        )}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {alreadyInSection ? "Added" : "Add"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </aside>
    </>
  );
};

// =============================================================================
// Tiny KPI card under the map
// =============================================================================

interface KpiCardProps {
  label: string;
  value: string;
  source: "live" | "mock" | "loading";
  accentClassName: string;
  /** When provided, renders a gear icon that opens the KPI picker. */
  onConfigure?: () => void;
  /** Marks the gear with a small dot when the tile is overridden. */
  isCustomized?: boolean;
  /** Body text for the (?) info tooltip. Hides the icon when omitted. */
  description?: string;
  /**
   * Qualitative "what counts as good?" sentence rendered in the
   * THRESHOLDS section. The KPI cards in this column are string-
   * valued (site labels — top incident volume, operational lead),
   * so they have no numeric threshold; this note explains how to
   * read the value instead.
   */
  thresholdNote?: string;
  /**
   * Italic footnote shown at the bottom of the tooltip — typically the
   * search binding (saved-search stanza or "(inline SPL)") so the
   * operator can trace the data lineage at a glance.
   */
  bindingFootnote?: string;
  /**
   * Click handler for the ExternalLink icon — opens the literal SPL
   * the tile dispatched in the standard Splunk Search & Reporting UI.
   * Hidden when omitted, matching `MetricItem`'s behavior.
   */
  onOpenInSearch?: () => void;
}

// =============================================================================
// Regional view toggle (MAP / TABLE)
// =============================================================================

type RegionalView = "map" | "table";

interface RegionalViewToggleProps {
  value: RegionalView;
  onChange: (next: RegionalView) => void;
}

const RegionalViewToggle: React.FC<RegionalViewToggleProps> = ({
  value,
  onChange,
}) => {
  const baseClass =
    "px-3 py-1 text-[10px] font-bold transition-colors rounded focus:outline-none focus:ring-1 focus:ring-sky-400";
  const activeClass =
    "bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 text-sky-600 dark:text-sky-300";
  const inactiveClass =
    "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300";
  return (
    <div
      role="tablist"
      aria-label="Topology view"
      className="flex bg-slate-100 dark:bg-slate-800/60 p-1 rounded-md"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === "map"}
        onClick={() => onChange("map")}
        className={cn(baseClass, value === "map" ? activeClass : inactiveClass)}
      >
        MAP
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "table"}
        onClick={() => onChange("table")}
        className={cn(
          baseClass,
          value === "table" ? activeClass : inactiveClass,
        )}
      >
        TABLE
      </button>
    </div>
  );
};

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
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [tableColumns, setTableColumns] = useState<MetricDetailTableColumn[]>(
    config.columns,
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [sortState, setSortState] = useState<MetricDetailSortState | null>(
    null,
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setRows([]);
    setTableColumns(config.columns);
    setErrorMessage("");

    runSearch({
      spl: config.spl,
      earliestTime: range.earliest,
      latestTime: range.latest,
      tag: config.tag,
      appContext: config.dispatchContext,
    })
      .then((res) => {
        if (cancelled) return;
        const rawRows = (res?.results ?? []) as Array<Record<string, unknown>>;
        const columns =
          config.columns.length > 0
            ? config.columns
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
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          setTableColumns(config.columns);
          setErrorMessage(config.errorMessage);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [config, range.earliest, range.latest, refreshToken]);

  const availableStatus = config.availableStatus ?? "Available";
  const unavailableStatus = config.unavailableStatus ?? "Unavailable";
  const titleId = `${config.tag}-title`;
  const statusField = config.statusField;
  const displayColumns =
    tableColumns.length > 0 ? tableColumns : config.columns;
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
    config.spl,
    range,
    config.dispatchContext,
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[1900] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-6xl max-h-[88vh] overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-2xl">
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Table2 className="w-4 h-4 text-sky-600 dark:text-sky-300" />
              <h2
                id={titleId}
                className="text-base font-bold text-slate-900 dark:text-slate-100"
              >
                {config.title}
              </h2>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {config.subtitle(range)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {statusField && (
              <div className="hidden sm:flex items-center gap-2 text-xs font-semibold">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2 py-1 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-3 h-3" />
                  {availableCount} available
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-950/50 px-2 py-1 text-rose-700 dark:text-rose-300">
                  <AlertCircle className="w-3 h-3" />
                  {unavailableCount} unavailable
                </span>
              </div>
            )}
            <a
              href={searchUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={`Open ${config.title} in Search`}
              aria-label={`Open ${config.title} in Search`}
              className="inline-flex items-center gap-1.5 rounded border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-sky-700 dark:hover:text-sky-200 hover:border-sky-300 dark:hover:border-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in Search</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              title="Close"
              aria-label={`Close ${config.title}`}
              className="p-1.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-auto max-h-[calc(88vh-90px)]">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="sticky top-0 z-10 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
              <tr className="text-left text-xs font-bold text-slate-500 dark:text-slate-400">
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
                          "group inline-flex w-full items-center gap-1.5 rounded px-1 py-0.5 -mx-1 text-left transition-colors hover:text-sky-600 dark:hover:text-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-400",
                          column.align === "right"
                            ? "justify-end"
                            : "justify-start",
                          isSorted && "text-sky-600 dark:text-sky-300",
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
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td
                    colSpan={columnCount}
                    className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    Loading {config.title.toLowerCase()}...
                  </td>
                </tr>
              ) : errorMessage ? (
                <tr>
                  <td
                    colSpan={columnCount}
                    className="px-5 py-10 text-center text-sm text-rose-600 dark:text-rose-300"
                  >
                    {errorMessage}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columnCount}
                    className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    {config.emptyMessage}
                  </td>
                </tr>
              ) : (
                sortedRows.map((row, rowIndex) => {
                  const rowStatus = statusField ? row[statusField] : "";
                  const rowIsAvailable = rowStatus === availableStatus;
                  const rowKey =
                    (config.rowKeyField && row[config.rowKeyField]) ||
                    displayColumns
                      .map((column) => row[column.field])
                      .join("|") ||
                    "detail-row";
                  return (
                    <tr
                      key={`${rowKey}-${rowIndex}`}
                      className="hover:bg-slate-50 dark:hover:bg-slate-900/70 transition-colors"
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
                                ? "px-5 font-medium text-slate-900 dark:text-slate-100"
                                : "px-4 text-slate-600 dark:text-slate-300",
                              "py-3",
                              column.align === "right" &&
                                "text-right tabular-nums",
                              column.truncate && "max-w-xs truncate",
                              column.kind === "metric" &&
                                statusField &&
                                (rowIsAvailable
                                  ? "font-medium text-emerald-600 dark:text-emerald-300"
                                  : "font-medium text-rose-600 dark:text-rose-300"),
                            )}
                          >
                            {isStatusColumn ? (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold",
                                  statusIsAvailable
                                    ? "bg-emerald-600 text-white"
                                    : statusIsUnavailable
                                      ? "bg-rose-600 text-white"
                                      : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
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
        </div>
      </div>
    </div>
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
    "w-full px-2 py-1.5 text-sm bg-white dark:bg-slate-800 border " +
    "border-slate-300 dark:border-slate-600 rounded text-slate-900 " +
    "dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 " +
    "focus:outline-none focus:ring-1 focus:ring-sky-400";
  const labelClass =
    "block text-[10px] font-bold text-slate-600 dark:text-slate-400 " +
    "uppercase tracking-wider mb-1";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="section-titles-editor-title"
      className="fixed inset-0 z-[60] flex items-center justify-center"
      onClick={(e) => {
        if (!isSaving && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <h2
            id="section-titles-editor-title"
            className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider"
          >
            Edit sections
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            title="Close"
            aria-label="Close"
            className={cn(
              "p-1 rounded text-slate-400 hover:text-slate-600",
              "dark:hover:text-slate-300 hover:bg-slate-100",
              "dark:hover:bg-slate-800 transition-colors",
              isSaving && "cursor-not-allowed opacity-50",
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {layoutDraft.length} of {maxSections} visible
            </div>
            <button
              type="button"
              onClick={addSection}
              disabled={!canAddSection || isSaving}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded",
                "border border-sky-200 bg-sky-50 text-xs font-bold",
                "text-sky-700 hover:bg-sky-100 dark:border-sky-900/60",
                "dark:bg-sky-950/40 dark:text-sky-200",
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
                      ? "border-sky-200 bg-sky-50/60 dark:border-sky-900/60 dark:bg-sky-950/20"
                      : "border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800/40",
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
                      <span className="ml-2 text-[9px] font-black text-slate-400 dark:text-slate-500">
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
                        "inline-flex h-8 items-center gap-1.5 rounded px-2",
                        "text-xs font-bold transition-colors",
                        isVisible
                          ? "bg-white text-slate-600 hover:text-slate-900 dark:bg-slate-900 dark:text-slate-300"
                          : "bg-sky-600 text-white hover:bg-sky-500",
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
            <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span className="min-w-0 break-words">{errorMessage}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={reset}
            disabled={isSaving}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded border",
              "border-slate-300 dark:border-slate-600 text-xs font-bold",
              "text-slate-700 dark:text-slate-200 hover:bg-slate-50",
              "dark:hover:bg-slate-800 transition-colors",
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
                "px-3 py-1.5 rounded border border-slate-300",
                "dark:border-slate-600 text-xs font-bold text-slate-700",
                "dark:text-slate-200 hover:bg-slate-50",
                "dark:hover:bg-slate-800 transition-colors",
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
                "rounded bg-sky-600 text-xs font-bold text-white",
                "hover:bg-sky-500 transition-colors",
                isSaving && "cursor-not-allowed opacity-60",
              )}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
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
   * Falls back through `customerName` (macro) → hardcoded fallback,
   * matching the precedence rules in the live header. */
  titlePlaceholder: string;
  /** Placeholder text for the subtitle input. Always the
   * out-of-the-box default ("Splunk Executive Insights"). */
  subtitlePlaceholder: string;
  /** Image src to display in the "current logo" preview when no
   * override logo is set. Lets the user see what they're replacing. */
  logoFallbackSrc: string;
  onSave: (next: BrandingOverride) => boolean;
  onResetToDefaults: () => void;
}

/**
 * Centered modal for editing the per-user header branding override
 * (title, subtitle, logo). Title and subtitle are plain text inputs;
 * the logo is a file upload that's encoded to a `data:` URI and
 * stored in localStorage by the parent's `useBrandingOverride` hook.
 *
 * Behaviour notes:
 *  - "Save" persists whatever's in the form fields. Empty strings
 *    are treated as "use the default" — the hook strips them so
 *    the live header re-derives from the macro / hardcoded
 *    constants. Returning `false` from `onSave` (e.g. logo too big)
 *    keeps the modal open with an inline error.
 *  - "Reset to defaults" wipes the override entirely (storage key
 *    removed) and closes the modal.
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

  const handleSave = () => {
    const next: BrandingOverride = {
      title: titleField.trim() || undefined,
      subtitle: subtitleField.trim() || undefined,
      logoDataUri,
    };
    const ok = onSave(next);
    if (!ok) {
      setErrorMessage(
        "Could not save branding (logo may exceed the size limit). Please try a smaller image.",
      );
      return;
    }
    onClose();
  };

  const previewLogoSrc = logoDataUri || logoFallbackSrc;
  const acceptList = BRANDING_ACCEPTED_LOGO_MIME_TYPES.join(",");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="branding-editor-title"
      className="fixed inset-0 z-[60] flex items-center justify-center"
      onClick={(e) => {
        // Close only when the user clicks the backdrop itself,
        // not when their drag started inside an input and ended
        // on the backdrop. The shallow `e.target === e.currentTarget`
        // check is the standard React idiom.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />

      {/* Card */}
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <h2
            id="branding-editor-title"
            className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider"
          >
            Edit branding
          </h2>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            aria-label="Close"
            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Title */}
          <div>
            <label
              htmlFor="branding-title-input"
              className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1"
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
              className="w-full px-2 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-400"
            />
            <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-500">
              Leave blank to use the value from the
              <code className="mx-1 px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                [customer_name]
              </code>
              macro.
            </p>
          </div>

          {/* Subtitle */}
          <div>
            <label
              htmlFor="branding-subtitle-input"
              className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1"
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
              className="w-full px-2 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-400"
            />
            <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-500">
              Leave blank for the default (&ldquo;{subtitlePlaceholder}&rdquo;).
            </p>
          </div>

          {/* Logo */}
          <div>
            <span className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
              Logo
            </span>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-sky-600 rounded-lg flex items-center justify-center text-white overflow-hidden p-1 flex-shrink-0">
                <img
                  src={previewLogoSrc}
                  alt="Logo preview"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-900/30 hover:bg-sky-100 dark:hover:bg-sky-900/50 rounded transition-colors"
                >
                  <Upload className="w-3 h-3" />
                  {logoDataUri ? "Replace logo" : "Upload logo"}
                </button>
                {logoDataUri ? (
                  <button
                    type="button"
                    onClick={handleClearLogo}
                    className="text-[10px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline"
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
            <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-500">
              PNG, SVG, JPEG, WebP, or GIF. Max{" "}
              {Math.round(BRANDING_LOGO_DATA_URI_MAX_BYTES / 1024)} KB after
              encoding. Stored in your browser only.
            </p>
          </div>

          {errorMessage ? (
            <div
              role="alert"
              className="text-[11px] text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded px-2 py-1.5"
            >
              {errorMessage}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onResetToDefaults}
            className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 underline"
          >
            Reset to defaults
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-3 py-1.5 text-[11px] font-bold text-white bg-sky-600 hover:bg-sky-700 rounded transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Map position relative to the metric tile column. Persisted to
// `scd_overview_map_pos` in localStorage; cleared by the factory reset.
// See the splitter / map-position useState block in the Overview page
// for the wiring and the rationale on defaulting to `right` (Build 83).
type MapPosition = "right" | "below" | "above";

interface MapPositionToggleProps {
  value: MapPosition;
  onChange: (next: MapPosition) => void;
}

// Three-segment selector for the topology map's placement, rendered
// in the map card header next to the MAP/TABLE toggle. Each segment
// is an icon-only button (PanelBottom / PanelRight / PanelTop) with a
// title tooltip so the meaning stays clear at icon-only widths. The
// styling mirrors `RegionalViewToggle` for visual parity in the
// header.
const MapPositionToggle: React.FC<MapPositionToggleProps> = ({
  value,
  onChange,
}) => {
  const baseClass =
    "p-1 transition-colors rounded focus:outline-none focus:ring-1 focus:ring-sky-400";
  const activeClass =
    "bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 text-sky-600 dark:text-sky-300";
  const inactiveClass =
    "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300";
  const options: Array<{
    id: MapPosition;
    icon: React.ReactNode;
    label: string;
  }> = [
    {
      id: "below",
      icon: <PanelBottom className="w-3.5 h-3.5" />,
      label: "Map below tiles",
    },
    {
      id: "right",
      icon: <PanelRight className="w-3.5 h-3.5" />,
      label: "Map on the right",
    },
    {
      id: "above",
      icon: <PanelTop className="w-3.5 h-3.5" />,
      label: "Map above tiles",
    },
  ];
  return (
    <div
      role="tablist"
      aria-label="Map position"
      className="flex bg-slate-100 dark:bg-slate-800/60 p-1 rounded-md"
    >
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="tab"
          aria-selected={value === opt.id}
          aria-label={opt.label}
          title={opt.label}
          onClick={() => onChange(opt.id)}
          className={cn(
            baseClass,
            value === opt.id ? activeClass : inactiveClass,
          )}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );
};

const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  source,
  accentClassName,
  onConfigure,
  isCustomized = false,
  description,
  thresholdNote,
  bindingFootnote,
  onOpenInSearch,
}) => (
  <div className="p-2 border border-slate-100 dark:border-slate-800 rounded-lg bg-slate-50/50 dark:bg-slate-800/40 relative">
    <span
      className={
        "absolute top-1 right-2 w-1.5 h-1.5 rounded-full " +
        (source === "live"
          ? "bg-emerald-500"
          : source === "loading"
            ? "bg-amber-400 animate-pulse"
            : "bg-slate-300 dark:bg-slate-600")
      }
      title={
        source === "live"
          ? "Live"
          : source === "loading"
            ? "Loading…"
            : "No live source assigned"
      }
    />
    <div className="flex items-center gap-2 mb-0.5">
      <div className={cn("w-1.5 h-1.5 rounded-full", accentClassName)} />
      <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate flex-1">
        {label}
      </span>
      {description && (
        <InfoTooltip
          title={label}
          description={description}
          thresholdNote={thresholdNote}
          footnote={bindingFootnote}
          anchor="right"
          iconAriaLabel={`What is ${label}?`}
          className="flex-shrink-0"
        />
      )}
      {onOpenInSearch && (
        <button
          type="button"
          onClick={onOpenInSearch}
          title="Open in Search"
          aria-label={`Open ${label} in Search`}
          className="p-0.5 -my-0.5 text-slate-300 dark:text-slate-500 hover:text-sky-600 dark:hover:text-sky-300 transition-colors rounded focus:outline-none focus:ring-1 focus:ring-sky-400 flex-shrink-0"
        >
          <ExternalLink className="w-3 h-3 stroke-[2.5px]" />
        </button>
      )}
      {onConfigure && (
        <button
          type="button"
          onClick={onConfigure}
          title={
            isCustomized
              ? `Configure ${label} (customised)`
              : `Configure ${label}`
          }
          aria-label={`Configure ${label} tile`}
          className="p-0.5 -my-0.5 mr-2 text-slate-300 dark:text-slate-500 hover:text-sky-600 dark:hover:text-sky-300 transition-colors rounded focus:outline-none focus:ring-1 focus:ring-sky-400 relative flex-shrink-0"
        >
          <Settings2 className="w-3 h-3 stroke-[2.5px]" />
          {isCustomized && (
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-sky-500 border border-white dark:border-slate-900" />
          )}
        </button>
      )}
    </div>
    <p
      className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-tight truncate"
      title={value}
    >
      {value}
    </p>
  </div>
);

export default OverviewPage;
