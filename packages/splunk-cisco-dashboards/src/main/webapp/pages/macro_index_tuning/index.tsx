import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  ExternalLink,
  Info,
  Loader2,
  Play,
  RefreshCw,
  Save,
  Search,
} from "lucide-react";
import { getDefaultFetchInit } from "@splunk/splunk-utils/fetch";
import TimeRangeDropdown from "@splunk/react-time-range/Dropdown";

import {
  getSearchAppContext,
  isAbortError,
  runSearch,
} from "@/common/services/splunkSearchService";
import { getSearchbaseCatalogue } from "@/common/services/searchbaseCatalogue";
import { splunkSearchAppUrl } from "@/common/lib/splunkSearchUrl";
import timeParser from "../dashboardbuilder/custominput/timeparser";

const APP_NAME = "splunk-cisco-dashboards";
const APP_HOME_VIEW = "secure_networking_profile";
const APP_SETUP_VIEW = "start";
const CIM_APP_NAME = "Splunk_SA_CIM";
const CISCO_SECURITY_APP_NAME = "CiscoSecurityCloud";
const THOUSAND_EYES_APP_NAME = "ta_cisco_thousandeyes";
const TUNING_SEARCHBASE_ID = "admin_macro_index_tuning";
const TUNING_SEARCH_NAME = "Admin - Macro Index Tuning";
const ADHOC_MACRO_NAME = "scd_summariesonly";
const DEFAULT_SUMMARIESONLY_DEFINITION =
  "summariesonly=false allow_old_summaries=false fillnull_value=null";
const DEFAULT_SUMMARIESONLY_DESCRIPTION =
  "Controls whether data-model searches use only accelerated summaries or may fall back to raw events. Keep summariesonly=false until all required data models are fully accelerated.";
const SUMMARIESONLY_ACCELERATION_ERROR =
  "summariesonly=true requires acceleration for Cisco Catalyst, Cisco Security, and Cisco ThousandEyes.";
const DEFAULT_INDEX_IN_DEFINITION = "index IN (*)";
const DEFAULT_INDEX_OR_DEFINITION = "(index=*)";
const SCD_INDEX_MACRO_OR_PLACEHOLDER = "__SCD_INDEX_MACRO_OR__";
const FALLBACK_SCD_INDEX_MACRO_NAMES = [
  "index_catalyst",
  "index_cloud_native",
  "index_cybervision",
  "index_dc",
  "index_dhcp",
  "index_duo",
  "index_f5",
  "index_firewall",
  "index_identity",
  "index_intersight",
  "index_meraki",
  "index_network",
  "index_nvm",
  "index_sdwan",
  "index_security",
  "index_spaces",
  "index_thousandeyes",
  "index_ucs",
  "index_windows",
  "index_zeek",
] as const;
const CIM_MACRO_NAMES = [
  "cim_Authentication_indexes",
  "cim_Network_Traffic_indexes",
] as const;
const CISCO_SECURITY_MODEL_MACRO_NAMES = [
  "nvm_sysdata_index",
  "nvm_process_index",
  "nvm_flowdata_index",
  "nvm_combined_index",
] as const;
const THOUSAND_EYES_MODEL_MACRO_NAMES = [
  "stream_index",
  "path_viz_index",
  "activity_index",
  "event_index",
  "trace_index",
  "alert_index",
] as const;
const TARGET_APP_ORDER = [
  APP_NAME,
  CISCO_SECURITY_APP_NAME,
  THOUSAND_EYES_APP_NAME,
  CIM_APP_NAME,
] as const;
const TARGET_APP_LABELS: Record<string, string> = {
  [APP_NAME]: "SCD",
  [CIM_APP_NAME]: "CIM",
  [CISCO_SECURITY_APP_NAME]: "Cisco Security",
  [THOUSAND_EYES_APP_NAME]: "ThousandEyes",
};
const CISCO_SECURITY_DEFINITION_SUFFIXES: Record<string, string> = {
  nvm_sysdata_index: 'sourcetype="cisco:nvm:sysdata:v2"',
  nvm_process_index: 'sourcetype="cisco:nvm:processinfodata:v2"',
  nvm_flowdata_index: 'sourcetype="cisco:nvm:flowdata:v2"',
  nvm_combined_index:
    '(sourcetype="cisco:nvm:flowdata:v2" OR sourcetype="cisco:nvm:processinfodata:v2")',
};
const EXTERNAL_MACRO_DESCRIPTIONS: Record<string, string> = {
  cim_Authentication_indexes:
    "Limits Splunk CIM Authentication data-model searches to indexes containing authentication-tagged events.",
  cim_Network_Traffic_indexes:
    "Limits Splunk CIM Network Traffic data-model searches to indexes containing network communication events.",
  nvm_sysdata_index:
    "Routes Cisco Security Cloud endpoint inventory searches to indexes containing Cisco NVM system-data events.",
  nvm_process_index:
    "Routes Cisco Security Cloud process inventory searches to indexes containing Cisco NVM process-information events.",
  nvm_flowdata_index:
    "Routes Cisco Security Cloud endpoint network searches to indexes containing Cisco NVM flow-data events.",
  nvm_combined_index:
    "Routes Cisco Security Cloud correlation searches across both Cisco NVM flow-data and process-information events.",
  stream_index:
    "Routes ThousandEyes metric and stream searches to indexes containing test measurement events.",
  path_viz_index:
    "Routes ThousandEyes path visualization searches to indexes containing hop-by-hop path data.",
  activity_index:
    "Routes ThousandEyes audit and activity searches to indexes containing account activity events.",
  event_index:
    "Routes ThousandEyes event searches to indexes containing outage and test event records.",
  trace_index:
    "Routes ThousandEyes trace searches to indexes containing detailed test trace records.",
  alert_index:
    "Routes ThousandEyes alert searches to indexes containing active and historical alert events.",
};

type ScanState = "idle" | "loading" | "ready" | "error";
type SaveState = "idle" | "saving" | "saved" | "error";
type CopyState = "idle" | "copied" | "selected" | "error";
type DefinitionFormat = "indexIn" | "indexOr";
type DataModelAccelerationState =
  | "checking"
  | "enabled"
  | "disabled"
  | "missing"
  | "error";

interface SearchTimeRange {
  earliest: string;
  latest: string;
}

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

interface TunableMacroConfig {
  macro: string;
  targetApp: string;
  definitionFormat: DefinitionFormat;
  definitionSuffix?: string;
  family: "scd" | "cim" | "ciscoSecurity" | "thousandEyes";
}

const CIM_MACRO_CONFIGS: TunableMacroConfig[] = CIM_MACRO_NAMES.map(
  (macro) => ({
    macro,
    targetApp: CIM_APP_NAME,
    definitionFormat: "indexOr",
    family: "cim",
  }),
);
const CISCO_SECURITY_MODEL_MACRO_CONFIGS: TunableMacroConfig[] =
  CISCO_SECURITY_MODEL_MACRO_NAMES.map((macro) => ({
    macro,
    targetApp: CISCO_SECURITY_APP_NAME,
    definitionFormat: "indexOr",
    definitionSuffix: CISCO_SECURITY_DEFINITION_SUFFIXES[macro],
    family: "ciscoSecurity",
  }));
const THOUSAND_EYES_MODEL_MACRO_CONFIGS: TunableMacroConfig[] =
  THOUSAND_EYES_MODEL_MACRO_NAMES.map((macro) => ({
    macro,
    targetApp: THOUSAND_EYES_APP_NAME,
    definitionFormat: "indexOr",
    family: "thousandEyes",
  }));

const buildScdIndexMacroConfigs = (
  macroNames: readonly string[],
): TunableMacroConfig[] =>
  macroNames.map((macro) => ({
    macro,
    targetApp: APP_NAME,
    definitionFormat: "indexIn",
    family: "scd",
  }));

const buildTuningMacroCatalog = (scdIndexMacroNames: readonly string[]) => {
  const indexMacroConfigs = buildScdIndexMacroConfigs(scdIndexMacroNames);
  const fastTuningMacroConfigs: TunableMacroConfig[] = [
    ...indexMacroConfigs,
    ...CISCO_SECURITY_MODEL_MACRO_CONFIGS,
    ...THOUSAND_EYES_MODEL_MACRO_CONFIGS,
  ];
  const tunableMacroConfigs: TunableMacroConfig[] = [
    ...fastTuningMacroConfigs,
    ...CIM_MACRO_CONFIGS,
  ];

  return {
    indexMacroConfigs,
    fastTuningMacroConfigs,
    tunableMacroConfigs,
    indexMacroNameSet: new Set<string>(scdIndexMacroNames),
    fastTuningMacroNameSet: new Set<string>(
      fastTuningMacroConfigs.map((config) => config.macro),
    ),
    tunableMacroNameSet: new Set<string>(
      tunableMacroConfigs.map((config) => config.macro),
    ),
    macroConfigByName: new Map<string, TunableMacroConfig>(
      tunableMacroConfigs.map((config) => [config.macro, config]),
    ),
  };
};

const DEFAULT_TUNING_MACRO_CATALOG = buildTuningMacroCatalog(
  FALLBACK_SCD_INDEX_MACRO_NAMES,
);

const CIM_MACRO_NAME_SET = new Set<string>(CIM_MACRO_NAMES);

interface MacroRow {
  macro: string;
  description: string;
  targetApp: string;
  definitionFormat: DefinitionFormat;
  definition: string;
  indexes: string[];
  sourcetypes: string[];
  sourcetypeCount: number;
  events: number;
}

interface EditableMacroRow extends MacroRow {
  draftDefinition: string;
}

interface RowGroup {
  targetApp: string;
  rows: EditableMacroRow[];
}

interface SaveStatus {
  state: SaveState;
  message?: string;
}

interface MacroDetails {
  definition: string;
  description: string;
}

interface DataModelRequirement {
  key: string;
  label: string;
  app: string;
  model: string;
  priority: "required" | "recommended";
}

interface DataModelAcceleration extends DataModelRequirement {
  state: DataModelAccelerationState;
  earliestTime: string;
  message: string;
}

const DATA_MODEL_REQUIREMENTS: readonly DataModelRequirement[] = [
  {
    key: "catalyst",
    label: "Cisco Catalyst",
    app: "cisco-catalyst-app",
    model: "Cisco_Catalyst_App",
    priority: "required",
  },
  {
    key: "security",
    label: "Cisco Security",
    app: CISCO_SECURITY_APP_NAME,
    model: "Cisco_Security",
    priority: "required",
  },
  {
    key: "thousandeyes",
    label: "Cisco ThousandEyes",
    app: THOUSAND_EYES_APP_NAME,
    model: "Cisco_ThousandEyes",
    priority: "required",
  },
  {
    key: "authentication",
    label: "Authentication",
    app: CIM_APP_NAME,
    model: "Authentication",
    priority: "recommended",
  },
  {
    key: "network-traffic",
    label: "Network Traffic",
    app: CIM_APP_NAME,
    model: "Network_Traffic",
    priority: "recommended",
  },
] as const;

const DEFAULT_FAST_TIME_RANGE: SearchTimeRange = {
  earliest: "-7d@d",
  latest: "now",
};
const DEFAULT_CIM_TIME_RANGE: SearchTimeRange = {
  earliest: "-4h@h",
  latest: "now",
};
const TIME_PRESETS = [
  { label: "Today", earliest: "@d", latest: "now" },
  { label: "Week to date", earliest: "@w0", latest: "now" },
  { label: "Business week to date", earliest: "@w1", latest: "now" },
  { label: "Month to date", earliest: "@mon", latest: "now" },
  { label: "Year to date", earliest: "@y", latest: "now" },
  { label: "Yesterday", earliest: "-1d@d", latest: "@d" },
  { label: "Previous week", earliest: "-7d@w0", latest: "@w0" },
  { label: "Previous business week", earliest: "-6d@w1", latest: "-1d@w6" },
  { label: "Previous month", earliest: "-1mon@mon", latest: "@mon" },
  { label: "Previous year", earliest: "-1y@y", latest: "@y" },
  { label: "Last 15 minutes", earliest: "-15m", latest: "now" },
  { label: "Last 60 minutes", earliest: "-60m@m", latest: "now" },
  { label: "Last 4 hours", earliest: "-4h@m", latest: "now" },
  { label: "Last 24 hours", earliest: "-24h@h", latest: "now" },
  { label: "Last 7 days", earliest: "-7d@d", latest: "now" },
  { label: "Last 30 days", earliest: "-30d@d", latest: "now" },
  { label: "All time", earliest: "0", latest: "now" },
];

const CIM_DISCOVERY_SEARCH = [
  "search index=* tag=authentication NOT (action=success user=*$)",
  '| eval sourcetype=coalesce(sourcetype, "(unknown sourcetype)")',
  "| stats count by index, sourcetype",
  `| eval macro="cim_Authentication_indexes", target_app="${CIM_APP_NAME}", definition_format="indexOr"`,
  "| append [ search index=* tag=network tag=communicate",
  '| eval sourcetype=coalesce(sourcetype, "(unknown sourcetype)")',
  "| stats count by index, sourcetype",
  `| eval macro="cim_Network_Traffic_indexes", target_app="${CIM_APP_NAME}", definition_format="indexOr" ]`,
  "| stats values(index) as indexes, values(sourcetype) as sourcetypes, dc(sourcetype) as sourcetype_count, sum(count) as events by macro, target_app, definition_format",
  '| eval definition="(index=".mvjoin(indexes, " OR index=").")"',
  "| table macro, target_app, definition_format, definition, indexes, sourcetypes, sourcetype_count, events",
].join("\n");

const lightButtonBase =
  "inline-flex h-10 min-h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold leading-none transition disabled:cursor-not-allowed disabled:opacity-55";
const compactButtonBase =
  "inline-flex h-8 min-h-8 items-center justify-center gap-2 rounded border px-3 text-sm font-semibold leading-none transition disabled:cursor-not-allowed disabled:opacity-55";
const tableSearchInputBase =
  "h-10 min-h-10 w-full rounded-md border border-slate-300 bg-white py-0 pl-9 pr-3 text-sm leading-none text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100";

const normalizeText = (value: unknown): string =>
  Array.isArray(value)
    ? value.map((item) => String(item)).join(", ")
    : value == null
      ? ""
      : String(value);

const normalizeMultiValue = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => normalizeMultiValue(item))
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return normalizeText(value)
    .split(/[,\r\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeNumber = (value: unknown): number => {
  const parsed = Number(normalizeText(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const getMacroConfig = (
  macro: string,
  macroConfigByName: Map<
    string,
    TunableMacroConfig
  > = DEFAULT_TUNING_MACRO_CATALOG.macroConfigByName,
): TunableMacroConfig | undefined => macroConfigByName.get(macro);

const getTargetAppLabel = (targetApp: string): string =>
  TARGET_APP_LABELS[targetApp] || targetApp;

const normalizeDefinitionFormat = (value: unknown): DefinitionFormat => {
  const normalized = normalizeText(value).trim();
  return normalized === "indexOr" ? "indexOr" : "indexIn";
};

const parseSearchResult = (
  row: Record<string, unknown>,
  macroConfigByName: Map<
    string,
    TunableMacroConfig
  > = DEFAULT_TUNING_MACRO_CATALOG.macroConfigByName,
): MacroRow | null => {
  const macro = normalizeText(row.macro).trim();
  if (!macro) return null;
  const config = getMacroConfig(macro, macroConfigByName);
  const rowTargetApp = normalizeText(row.target_app ?? row.app).trim();
  return {
    macro,
    description: normalizeText(row.description).trim(),
    targetApp: config?.targetApp || rowTargetApp || APP_NAME,
    definitionFormat:
      config?.definitionFormat ||
      normalizeDefinitionFormat(row.definition_format),
    definition: normalizeText(row.definition).trim(),
    indexes: normalizeMultiValue(row.indexes),
    sourcetypes: normalizeMultiValue(row.sourcetypes),
    sourcetypeCount: normalizeNumber(row.sourcetype_count),
    events: normalizeNumber(row.events),
  };
};

const formatNumber = (value: number): string =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);

const getSplunkLocale = (): string => {
  if (typeof window === "undefined") return "en-US";
  const localeMatch = window.location.pathname.match(
    /^\/([a-z]{2}-[A-Z]{2})\//,
  );
  return localeMatch ? localeMatch[1] : "en-US";
};

const splunkManagerUrl = (managerPage: string): string =>
  `/${getSplunkLocale()}/manager/${APP_NAME}/${managerPage}`;

const splunkAppManagerUrl = (app: string, managerPage: string): string =>
  `/${getSplunkLocale()}/manager/${encodeURIComponent(app)}/${managerPage}`;

const splunkAppViewUrl = (view: string): string =>
  `/${getSplunkLocale()}/app/${encodeURIComponent(APP_NAME)}/${view}`;

const initialSetupConfigUrl = (): string =>
  `/${getSplunkLocale()}/splunkd/__raw/servicesNS/nobody/${encodeURIComponent(
    APP_NAME,
  )}/configs/conf-setup/install?output_mode=json`;

const dataModelConfigUrl = ({
  app,
  model,
}: Pick<DataModelRequirement, "app" | "model">): string =>
  `/${getSplunkLocale()}/splunkd/__raw/servicesNS/nobody/${encodeURIComponent(
    app,
  )}/configs/conf-datamodels/${encodeURIComponent(model)}?output_mode=json`;

const isInitialSetupMode = (): boolean =>
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("setup") === "1";

const isTrueConfigValue = (value: unknown): boolean =>
  value === true ||
  value === 1 ||
  value === "1" ||
  normalizeText(value).trim().toLowerCase() === "true";

const usesSummariesOnly = (definition: string): boolean =>
  /\bsummariesonly\s*=\s*(?:true|1)\b/i.test(definition);

const cleanIndexToken = (value: string): string =>
  value
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();

const extractIndexTokens = (definition: string): string[] => {
  const tokens = new Set<string>();
  const inMatch = definition.match(/\bindex\s+IN\s*\(([^)]*)\)/i);

  if (inMatch) {
    inMatch[1]
      .split(",")
      .map(cleanIndexToken)
      .filter(Boolean)
      .forEach((token) => tokens.add(token));
  }

  const equalityPattern = /\bindex\s*=\s*("[^"]+"|'[^']+'|[^\s|,)]+)/gi;
  let match = equalityPattern.exec(definition);
  while (match) {
    const token = cleanIndexToken(match[1]);
    if (token) tokens.add(token);
    match = equalityPattern.exec(definition);
  }

  return Array.from(tokens);
};

const formatIndexDefinition = (
  indexes: string[],
  definitionFormat: DefinitionFormat,
  definitionSuffix = "",
): string => {
  const tokens = indexes.map(cleanIndexToken).filter(Boolean);
  const suffix = definitionSuffix.trim() ? ` ${definitionSuffix.trim()}` : "";
  if (!tokens.length) {
    const defaultDefinition =
      definitionFormat === "indexOr"
        ? DEFAULT_INDEX_OR_DEFINITION
        : DEFAULT_INDEX_IN_DEFINITION;
    return `${defaultDefinition}${suffix}`;
  }
  if (definitionFormat === "indexOr") {
    return `(${tokens.map((index) => `index=${index}`).join(" OR ")})${suffix}`;
  }
  return `index IN (${tokens.join(", ")})${suffix}`;
};

const buildMacroStanzas = (
  rows: EditableMacroRow[],
  targetApp: string,
  tunableMacroNameSet: Set<string> = DEFAULT_TUNING_MACRO_CATALOG.tunableMacroNameSet,
): string =>
  rows
    .filter(
      (row) =>
        row.targetApp === targetApp &&
        tunableMacroNameSet.has(row.macro) &&
        row.draftDefinition.trim(),
    )
    .map((row) => {
      const description = row.description.replace(/\s+/g, " ").trim();
      return `[${row.macro}]\ndefinition = ${row.draftDefinition.trim()}\niseval = 0\ndescription = ${description}`;
    })
    .join("\n\n");

const buildMacroStanza = (
  macro: string,
  definition: string,
  description: string,
): string =>
  definition.trim()
    ? `[${macro}]\ndefinition = ${definition.trim()}\niseval = 0\ndescription = ${description.replace(/\s+/g, " ").trim()}`
    : "";

const macroStatusKey = (row: Pick<EditableMacroRow, "targetApp" | "macro">) =>
  `${row.targetApp}:${row.macro}`;

const buildExpectedEditableRows = (
  configs: readonly TunableMacroConfig[],
  parsedRows: readonly MacroRow[],
  currentDetails: Record<string, MacroDetails>,
): EditableMacroRow[] => {
  const scannedByMacro = new Map(
    parsedRows.map((row) => [macroStatusKey(row), row]),
  );

  return configs.map((config) => {
    const scanned = scannedByMacro.get(`${config.targetApp}:${config.macro}`);
    const details = currentDetails[`${config.targetApp}:${config.macro}`];
    const fallbackDefinition =
      details?.definition ||
      scanned?.definition ||
      formatIndexDefinition(
        [],
        config.definitionFormat,
        config.definitionSuffix,
      );
    const draftDefinition = scanned?.definition || fallbackDefinition;

    return {
      macro: config.macro,
      description:
        details?.description ||
        scanned?.description ||
        EXTERNAL_MACRO_DESCRIPTIONS[config.macro] ||
        `Controls index routing for ${config.macro} searches in ${getTargetAppLabel(config.targetApp)}.`,
      targetApp: config.targetApp,
      definitionFormat: config.definitionFormat,
      definition: draftDefinition,
      indexes: scanned?.indexes?.length
        ? scanned.indexes
        : extractIndexTokens(fallbackDefinition),
      sourcetypes: scanned?.sourcetypes || [],
      sourcetypeCount: scanned?.sourcetypeCount || 0,
      events: scanned?.events || 0,
      draftDefinition,
    };
  });
};

const groupRowsByTargetApp = (rows: EditableMacroRow[]): RowGroup[] => {
  const rowsByApp = rows.reduce<Map<string, EditableMacroRow[]>>(
    (groups, row) => {
      const appRows = groups.get(row.targetApp) || [];
      appRows.push(row);
      groups.set(row.targetApp, appRows);
      return groups;
    },
    new Map<string, EditableMacroRow[]>(),
  );

  const orderedGroups = TARGET_APP_ORDER.flatMap((targetApp) => {
    const appRows = rowsByApp.get(targetApp);
    rowsByApp.delete(targetApp);
    return appRows?.length ? [{ targetApp, rows: appRows }] : [];
  });
  const extraGroups = Array.from(rowsByApp.entries()).map(
    ([targetApp, appRows]) => ({ targetApp, rows: appRows }),
  );

  return [...orderedGroups, ...extraGroups];
};

const rowMatchesFilter = (row: EditableMacroRow, terms: string[]): boolean => {
  if (!terms.length) return true;
  const haystack = [
    row.macro,
    row.description,
    row.targetApp,
    row.definition,
    row.draftDefinition,
    ...row.indexes,
    ...row.sourcetypes,
  ]
    .join(" ")
    .toLowerCase();

  return terms.every((term) => haystack.includes(term));
};

const extractSplunkError = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") return null;
  const messages = (payload as { messages?: unknown }).messages;
  if (!Array.isArray(messages)) return null;
  const match = messages.find((message) => {
    if (!message || typeof message !== "object") return false;
    const type = String((message as { type?: unknown }).type ?? "");
    return /error|fatal/i.test(type);
  });
  if (!match || typeof match !== "object") return null;
  const text = (match as { text?: unknown }).text;
  return typeof text === "string" && text.trim() ? text.trim() : null;
};

const macroConfigUrl = (
  macro: string,
  targetApp = getSearchAppContext(),
): string => {
  const app = encodeURIComponent(targetApp);
  return `/en-US/splunkd/__raw/servicesNS/nobody/${app}/configs/conf-macros/${encodeURIComponent(
    macro,
  )}?output_mode=json`;
};

const scdMacrosCatalogUrl = (): string => {
  const app = encodeURIComponent(APP_NAME);
  return `/en-US/splunkd/__raw/servicesNS/nobody/${app}/configs/conf-macros?count=0&output_mode=json`;
};

const buildIndexMacroOrClause = (macroNames: readonly string[]): string => {
  const names = [...macroNames].sort();
  if (!names.length) {
    return "index=*";
  }
  if (names.length === 1) {
    return `\`${names[0]}\``;
  }
  return names.map((name) => `\`${name}\``).join(" OR ");
};

const injectIndexMacroOrClause = (
  spl: string,
  macroNames: readonly string[],
): string => {
  const clause = buildIndexMacroOrClause(macroNames);
  if (spl.includes(SCD_INDEX_MACRO_OR_PLACEHOLDER)) {
    return spl.replace(SCD_INDEX_MACRO_OR_PLACEHOLDER, clause);
  }
  return spl.replace(
    /`\s*index_[a-z0-9_]+\s*`(?:\s+OR\s+`\s*index_[a-z0-9_]+\s*`)+/i,
    clause,
  );
};

const loadScdIndexMacroNames = async (): Promise<string[]> => {
  const response = await fetch(scdMacrosCatalogUrl(), {
    ...getDefaultFetchInit(),
    method: "GET",
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(
      extractSplunkError(payload) ||
        `Could not list SCD index macros (HTTP ${response.status}).`,
    );
  }

  const entries = (payload as { entry?: Array<{ name?: unknown }> } | null)
    ?.entry;
  const names = (entries ?? [])
    .map((entry) => normalizeText(entry?.name).trim())
    .filter((name) => name.startsWith("index_"));

  return names.length
    ? Array.from(new Set(names)).sort()
    : [...FALLBACK_SCD_INDEX_MACRO_NAMES];
};

const saveMacroDefinition = async (
  macro: string,
  definition: string,
  description: string,
  targetApp = APP_NAME,
): Promise<void> => {
  const response = await fetch(macroConfigUrl(macro, targetApp), {
    ...getDefaultFetchInit(),
    method: "POST",
    body: new URLSearchParams({
      definition,
      description,
      iseval: "0",
    }).toString(),
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(
      extractSplunkError(payload) ||
        `Save failed with HTTP ${response.status}.`,
    );
  }
};

const completeInitialSetup = async (): Promise<void> => {
  const response = await fetch(initialSetupConfigUrl(), {
    ...getDefaultFetchInit(),
    method: "POST",
    body: new URLSearchParams({ is_configured: "1" }).toString(),
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(
      extractSplunkError(payload) ||
        `Setup could not be completed (HTTP ${response.status}).`,
    );
  }
};

const loadDataModelAcceleration = async (
  requirement: DataModelRequirement,
): Promise<DataModelAcceleration> => {
  const response = await fetch(dataModelConfigUrl(requirement), {
    ...getDefaultFetchInit(),
    method: "GET",
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    return {
      ...requirement,
      state: response.status === 404 ? "missing" : "error",
      earliestTime: "",
      message:
        extractSplunkError(payload) ||
        (response.status === 404
          ? "Data model was not found"
          : `Acceleration check failed (HTTP ${response.status})`),
    };
  }

  const entries = (
    payload as {
      entry?: Array<{
        content?: {
          acceleration?: unknown;
          "acceleration.earliest_time"?: unknown;
          disabled?: unknown;
        };
      }>;
    } | null
  )?.entry;
  const content = entries?.[0]?.content;

  if (!content) {
    return {
      ...requirement,
      state: "missing",
      earliestTime: "",
      message: "Data model was not found",
    };
  }

  const disabled = isTrueConfigValue(content.disabled);
  const enabled = isTrueConfigValue(content.acceleration) && !disabled;
  return {
    ...requirement,
    state: enabled ? "enabled" : "disabled",
    earliestTime: normalizeText(
      content["acceleration.earliest_time"],
    ).trim(),
    message: disabled
      ? "Data model is disabled"
      : enabled
        ? "Acceleration enabled"
        : "Acceleration is not enabled",
  };
};

const loadMacroDetails = async (
  macro: string,
  targetApp = APP_NAME,
): Promise<MacroDetails> => {
  const response = await fetch(macroConfigUrl(macro, targetApp), {
    ...getDefaultFetchInit(),
    method: "GET",
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(
      extractSplunkError(payload) ||
        `Load failed with HTTP ${response.status}.`,
    );
  }

  const entries = (
    payload as {
      entry?: Array<{
        content?: { definition?: unknown; description?: unknown };
      }>;
    } | null
  )?.entry;
  const content = entries?.[0]?.content;
  return {
    definition: normalizeText(content?.definition).trim(),
    description: normalizeText(content?.description).trim(),
  };
};

const loadMacroDetailsByConfig = async (
  configs: readonly TunableMacroConfig[],
): Promise<Record<string, MacroDetails>> => {
  const pairs = await Promise.all(
    configs.map(async (config) => {
      try {
        return [
          `${config.targetApp}:${config.macro}`,
          await loadMacroDetails(config.macro, config.targetApp),
        ] as const;
      } catch {
        return [
          `${config.targetApp}:${config.macro}`,
          { definition: "", description: "" },
        ] as const;
      }
    }),
  );

  return Object.fromEntries(pairs);
};

const copyTextToClipboard = async (text: string): Promise<void> => {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to execCommand for plain-http Splunk Web sessions.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error("Clipboard copy was blocked by the browser.");
  }
};

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

function CopyButton({
  text,
  label,
  targetRef,
}: {
  text: string;
  label: string;
  targetRef?: React.RefObject<HTMLTextAreaElement | null>;
}): JSX.Element {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  const onCopy = useCallback(() => {
    if (!text) return;
    copyTextToClipboard(text)
      .then(() => {
        setCopyState("copied");
        window.setTimeout(() => setCopyState("idle"), 1400);
      })
      .catch(() => {
        const target = targetRef?.current;
        if (target) {
          target.focus();
          target.select();
          target.setSelectionRange(0, target.value.length);
          setCopyState("selected");
          window.setTimeout(() => setCopyState("idle"), 2600);
          return;
        }
        setCopyState("error");
        window.setTimeout(() => setCopyState("idle"), 2600);
      });
  }, [targetRef, text]);

  const icon =
    copyState === "copied" ? <Check size={16} /> : <ClipboardCopy size={16} />;
  const buttonLabel =
    copyState === "copied"
      ? "Copied"
      : copyState === "selected"
        ? "Selected"
        : copyState === "error"
          ? "Copy failed"
          : label;

  return (
    <button
      type="button"
      onClick={onCopy}
      disabled={!text}
      title={
        copyState === "selected"
          ? "Clipboard access was blocked, so the preview text was selected. Press Command-C or Ctrl-C."
          : copyState === "error"
            ? "Clipboard access was blocked by the browser."
            : undefined
      }
      className={`${lightButtonBase} border-slate-300 bg-white text-slate-700 hover:border-sky-400 hover:text-sky-700`}
    >
      {icon}
      {buttonLabel}
    </button>
  );
}

function FieldPills({
  values,
  tone = "slate",
  expandable = false,
  valueLabel = "values",
}: {
  values: string[];
  tone?: "slate" | "sky";
  expandable?: boolean;
  valueLabel?: string;
}): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const canExpand = expandable && values.length > 6;
  const visible = canExpand && expanded ? values : values.slice(0, 6);
  const extra = Math.max(0, values.length - visible.length);
  const classes =
    tone === "sky"
      ? "border-sky-100 bg-sky-50 text-sky-800"
      : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((value) => (
        <span
          key={value}
          className={`max-w-[220px] truncate rounded border px-2 py-0.5 font-mono text-xs ${classes}`}
          title={value}
        >
          {value}
        </span>
      ))}
      {extra > 0 && canExpand && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-semibold text-sky-700 hover:border-sky-400 hover:bg-sky-50"
          title={`Show ${extra} more ${valueLabel}`}
        >
          +{extra}
        </button>
      )}
      {extra > 0 && !canExpand && (
        <span className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-500">
          +{extra}
        </span>
      )}
      {canExpand && expanded && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 hover:border-slate-400 hover:bg-slate-50"
        >
          Show fewer
        </button>
      )}
    </div>
  );
}

function MacroInfoBox({
  macro,
  description,
}: {
  macro: string;
  description: string;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const boxId = `macro-info-${macro.replace(/[^a-z0-9_-]/gi, "-")}`;

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={boxId}
        title={`About ${macro}`}
        className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700"
      >
        <Info size={15} aria-hidden="true" />
        <span className="sr-only">About {macro}</span>
      </button>
      {open && (
        <div
          id={boxId}
          role="note"
          className="mt-2 max-w-sm border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-slate-700"
        >
          {description || "No description is available for this macro."}
        </div>
      )}
    </div>
  );
}

function useTimeRangeParser(): {
  parseEarliest: TimeParseResult | undefined;
  parseLatest: TimeParseResult | undefined;
  handleRequestParseEarliest: (time: string) => void;
  handleRequestParseLatest: (time: string) => void;
} {
  const [parseEarliest, setParseEarliest] = useState<TimeParseResult>();
  const [parseLatest, setParseLatest] = useState<TimeParseResult>();
  const mountedRef = useRef(true);
  const earliestRequestRef = useRef(0);
  const latestRequestRef = useRef(0);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleRequestParseEarliest = useCallback((time: string) => {
    const requestId = earliestRequestRef.current + 1;
    earliestRequestRef.current = requestId;
    void timeParser(time, "en_US")
      .then((result: TimeParseResult) => {
        if (!mountedRef.current || requestId !== earliestRequestRef.current) {
          return;
        }
        setParseEarliest(normalizeTimeParseResult(result, time));
      })
      .catch(() => {
        if (!mountedRef.current || requestId !== earliestRequestRef.current) {
          return;
        }
        setParseEarliest({
          error: { message: "The time string could not be parsed" },
          time,
        });
      });
  }, []);

  const handleRequestParseLatest = useCallback((time: string) => {
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;
    void timeParser(time || "now", "en_US")
      .then((result: TimeParseResult) => {
        if (!mountedRef.current || requestId !== latestRequestRef.current) {
          return;
        }
        setParseLatest(normalizeTimeParseResult(result, time));
      })
      .catch(() => {
        if (!mountedRef.current || requestId !== latestRequestRef.current) {
          return;
        }
        setParseLatest({
          error: { message: "The time string could not be parsed" },
          time,
        });
      });
  }, []);

  return {
    parseEarliest,
    parseLatest,
    handleRequestParseEarliest,
    handleRequestParseLatest,
  };
}

export default function MacroIndexTuningPage(): JSX.Element {
  const setupMode = isInitialSetupMode();
  const [rows, setRows] = useState<EditableMacroRow[]>([]);
  const [cimRows, setCimRows] = useState<EditableMacroRow[]>([]);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [cimScanState, setCimScanState] = useState<ScanState>("idle");
  const [error, setError] = useState<string>("");
  const [cimError, setCimError] = useState<string>("");
  const [searchSpl, setSearchSpl] = useState<string>("");
  const [timeRange, setTimeRange] = useState<SearchTimeRange>(
    DEFAULT_FAST_TIME_RANGE,
  );
  const [cimTimeRange, setCimTimeRange] = useState<SearchTimeRange>(
    DEFAULT_CIM_TIME_RANGE,
  );
  const [filterText, setFilterText] = useState("");
  const [collapsedRowGroups, setCollapsedRowGroups] = useState<
    Record<string, boolean>
  >({});
  const [saveStatuses, setSaveStatuses] = useState<Record<string, SaveStatus>>(
    {},
  );
  const [adhocDefinition, setAdhocDefinition] = useState(
    DEFAULT_SUMMARIESONLY_DEFINITION,
  );
  const [adhocDescription, setAdhocDescription] = useState(
    DEFAULT_SUMMARIESONLY_DESCRIPTION,
  );
  const [adhocStatus, setAdhocStatus] = useState<SaveStatus>({ state: "idle" });
  const [dataModelReadiness, setDataModelReadiness] = useState<
    DataModelAcceleration[]
  >(() =>
    DATA_MODEL_REQUIREMENTS.map((requirement) => ({
      ...requirement,
      state: "checking",
      earliestTime: "",
      message: "Checking acceleration",
    })),
  );
  const [setupStatus, setSetupStatus] = useState<SaveStatus>({ state: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const cimAbortRef = useRef<AbortController | null>(null);
  const searchSplRef = useRef<string>("");
  const macroPreviewRef = useRef<HTMLTextAreaElement>(null);
  const fastTimeParser = useTimeRangeParser();
  const cimTimeParser = useTimeRangeParser();
  const allRows = useMemo(() => [...rows, ...cimRows], [cimRows, rows]);
  const [scdIndexMacroNames, setScdIndexMacroNames] = useState<string[]>([
    ...FALLBACK_SCD_INDEX_MACRO_NAMES,
  ]);
  const tuningMacroCatalog = useMemo(
    () => buildTuningMacroCatalog(scdIndexMacroNames),
    [scdIndexMacroNames],
  );
  const {
    fastTuningMacroConfigs,
    fastTuningMacroNameSet,
    indexMacroNameSet,
    tunableMacroNameSet,
    macroConfigByName,
  } = tuningMacroCatalog;

  const generatedMacroStanzasByApp = useMemo<Record<string, string>>(
    () =>
      Object.fromEntries(
        TARGET_APP_ORDER.map((targetApp) => [
          targetApp,
          buildMacroStanzas(allRows, targetApp, tunableMacroNameSet),
        ]),
      ),
    [allRows, tunableMacroNameSet],
  );
  const macroStanzas = useMemo(() => {
    const sections = TARGET_APP_ORDER.flatMap((targetApp) => {
      const parts = [
        targetApp === APP_NAME
          ? buildMacroStanza(
              ADHOC_MACRO_NAME,
              adhocDefinition,
              adhocDescription,
            )
          : "",
        generatedMacroStanzasByApp[targetApp] || "",
      ].filter(Boolean);
      return parts.length
        ? [`# ${targetApp}/local/macros.conf\n${parts.join("\n\n")}`]
        : [];
    });
    return sections.join("\n\n");
  }, [adhocDefinition, adhocDescription, generatedMacroStanzasByApp]);
  const hasUnknown = rows.some((row) => row.macro === "unknown");
  const fastTunableRows = rows.filter((row) =>
    fastTuningMacroNameSet.has(row.macro),
  );
  const cimMacroRows = cimRows.filter((row) =>
    CIM_MACRO_NAME_SET.has(row.macro),
  );
  const tunableRows = [...fastTunableRows, ...cimMacroRows];
  const indexMacroRows = tunableRows.filter((row) =>
    indexMacroNameSet.has(row.macro),
  );
  const modelMacroRows = tunableRows.filter(
    (row) =>
      row.targetApp === CISCO_SECURITY_APP_NAME ||
      row.targetApp === THOUSAND_EYES_APP_NAME,
  );
  const rowsToSave = tunableRows.filter((row) => row.draftDefinition.trim());
  const setupRowsToSave = rows.filter(
    (row) =>
      row.targetApp === APP_NAME &&
      row.macro.startsWith("index_") &&
      row.events > 0 &&
      row.draftDefinition.trim(),
  );
  const summariesOnlyEnabled = usesSummariesOnly(adhocDefinition);
  const requiredDataModels = dataModelReadiness.filter(
    (item) => item.priority === "required",
  );
  const allRequiredDataModelsAccelerated =
    requiredDataModels.length ===
      DATA_MODEL_REQUIREMENTS.filter(
        (requirement) => requirement.priority === "required",
      ).length &&
    requiredDataModels.every((item) => item.state === "enabled");
  const accelerationCheckInProgress = dataModelReadiness.some(
    (item) => item.state === "checking",
  );
  const summariesOnlyBlocked =
    summariesOnlyEnabled && !allRequiredDataModelsAccelerated;
  const filterTerms = useMemo(
    () => filterText.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [filterText],
  );
  const filteredRows = useMemo(
    () => rows.filter((row) => rowMatchesFilter(row, filterTerms)),
    [filterTerms, rows],
  );
  const filteredCimRows = useMemo(
    () => cimRows.filter((row) => rowMatchesFilter(row, filterTerms)),
    [cimRows, filterTerms],
  );
  const filteredRowGroups = useMemo(
    () => groupRowsByTargetApp(filteredRows),
    [filteredRows],
  );
  const isCimGroupCollapsed = Boolean(collapsedRowGroups[CIM_APP_NAME]);
  const totalEvents = rows
    .filter((row) => row.targetApp === APP_NAME)
    .reduce((sum, row) => sum + row.events, 0);
  const totalIndexValues = indexMacroRows.reduce(
    (sum, row) => sum + extractIndexTokens(row.draftDefinition).length,
    0,
  );
  const totalCimIndexValues = cimMacroRows.reduce(
    (sum, row) => sum + extractIndexTokens(row.draftDefinition).length,
    0,
  );
  const totalModelIndexValues = modelMacroRows.reduce(
    (sum, row) => sum + extractIndexTokens(row.draftDefinition).length,
    0,
  );
  const isLoading = scanState === "loading";
  const isCimLoading = cimScanState === "loading";
  const isSavingAll = Object.values(saveStatuses).some(
    (status) => status.state === "saving",
  );
  const resolvedSearchSpl = useMemo(
    () =>
      searchSpl ? injectIndexMacroOrClause(searchSpl, scdIndexMacroNames) : "",
    [scdIndexMacroNames, searchSpl],
  );
  const openSearchUrl = resolvedSearchSpl
    ? splunkSearchAppUrl(resolvedSearchSpl, timeRange)
    : "";
  const openCimSearchUrl = splunkSearchAppUrl(
    CIM_DISCOVERY_SEARCH,
    cimTimeRange,
  );
  const macrosManagerUrl = splunkManagerUrl("data/macros");
  const externalMacroManagerLinks = TARGET_APP_ORDER.filter(
    (targetApp) => targetApp !== APP_NAME,
  ).map((targetApp) => ({
    targetApp,
    href: splunkAppManagerUrl(targetApp, "data/macros"),
  }));

  const handleFastTimeRangeChange = useCallback(
    (_event: React.SyntheticEvent, data?: TimeRangeChange) => {
      setTimeRange((current) => ({
        earliest: data?.earliest ?? current.earliest,
        latest: data?.latest ?? current.latest,
      }));
    },
    [],
  );

  const handleCimTimeRangeChange = useCallback(
    (_event: React.SyntheticEvent, data?: TimeRangeChange) => {
      setCimTimeRange((current) => ({
        earliest: data?.earliest ?? current.earliest,
        latest: data?.latest ?? current.latest,
      }));
    },
    [],
  );

  const loadTuningSearch = useCallback(async (): Promise<string> => {
    if (searchSplRef.current) return searchSplRef.current;
    const catalogue = await getSearchbaseCatalogue({ includeHidden: true });
    const record = catalogue.find(
      (item) =>
        item.id === TUNING_SEARCHBASE_ID ||
        item.searchName === TUNING_SEARCH_NAME,
    );
    if (!record?.search) {
      throw new Error(
        `Could not find ${TUNING_SEARCHBASE_ID} in searchbase.conf.`,
      );
    }
    searchSplRef.current = record.search;
    setSearchSpl(record.search);
    return record.search;
  }, []);

  const runScan = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setScanState("loading");
    setError("");
    setSaveStatuses({});

    try {
      const rawSpl = await loadTuningSearch();
      const discoveredIndexMacroNames = await loadScdIndexMacroNames();
      setScdIndexMacroNames(discoveredIndexMacroNames);
      const catalog = buildTuningMacroCatalog(discoveredIndexMacroNames);
      const spl = injectIndexMacroOrClause(rawSpl, discoveredIndexMacroNames);
      const result = await runSearch({
        spl,
        earliestTime: timeRange.earliest,
        latestTime: timeRange.latest,
        count: 0,
        tag: TUNING_SEARCHBASE_ID,
        signal: controller.signal,
      });
      const currentDetails = await loadMacroDetailsByConfig(
        catalog.fastTuningMacroConfigs,
      );
      const parsed = ((result.results || []) as Record<string, unknown>[])
        .map((row) => parseSearchResult(row, catalog.macroConfigByName))
        .filter((row): row is MacroRow => Boolean(row));
      const expectedRows = buildExpectedEditableRows(
        catalog.fastTuningMacroConfigs,
        parsed,
        currentDetails,
      );
      const extraRows = parsed
        .filter(
          (row) =>
            !catalog.fastTuningMacroNameSet.has(row.macro) &&
            !CIM_MACRO_NAME_SET.has(row.macro),
        )
        .map((row) => ({
          ...row,
          draftDefinition: row.definition,
        }));
      setRows([...expectedRows, ...extraRows]);
      setScanState("ready");
    } catch (err) {
      if (isAbortError(err)) return;
      setScanState("error");
      setRows([]);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [loadTuningSearch, timeRange.earliest, timeRange.latest]);

  useEffect(() => {
    void runScan();
    return () => {
      abortRef.current?.abort();
    };
  }, [runScan]);

  const loadCimMacroRows = useCallback(async () => {
    const currentDetails = await loadMacroDetailsByConfig(CIM_MACRO_CONFIGS);
    setCimRows(
      buildExpectedEditableRows(CIM_MACRO_CONFIGS, [], currentDetails),
    );
  }, []);

  const runCimDiscovery = useCallback(async () => {
    cimAbortRef.current?.abort();
    const controller = new AbortController();
    cimAbortRef.current = controller;
    setCimScanState("loading");
    setCimError("");
    setSaveStatuses({});

    try {
      const result = await runSearch({
        spl: CIM_DISCOVERY_SEARCH,
        earliestTime: cimTimeRange.earliest,
        latestTime: cimTimeRange.latest,
        count: 0,
        tag: `${TUNING_SEARCHBASE_ID}:cim`,
        signal: controller.signal,
      });
      const currentDetails = await loadMacroDetailsByConfig(CIM_MACRO_CONFIGS);
      const parsed = ((result.results || []) as Record<string, unknown>[])
        .map((row) => parseSearchResult(row, macroConfigByName))
        .filter((row): row is MacroRow => Boolean(row));
      setCimRows(
        buildExpectedEditableRows(CIM_MACRO_CONFIGS, parsed, currentDetails),
      );
      setCimScanState("ready");
    } catch (err) {
      if (isAbortError(err)) return;
      setCimScanState("error");
      setCimError(err instanceof Error ? err.message : String(err));
    }
  }, [cimTimeRange.earliest, cimTimeRange.latest, macroConfigByName]);

  useEffect(() => {
    void loadCimMacroRows();
    return () => {
      cimAbortRef.current?.abort();
    };
  }, [loadCimMacroRows]);

  const loadAdhocMacro = useCallback(async () => {
    setAdhocStatus({ state: "saving", message: "Loading current macro" });
    try {
      const details = await loadMacroDetails(ADHOC_MACRO_NAME, APP_NAME);
      setAdhocDefinition(
        details.definition || DEFAULT_SUMMARIESONLY_DEFINITION,
      );
      setAdhocDescription(
        details.description || DEFAULT_SUMMARIESONLY_DESCRIPTION,
      );
      setAdhocStatus({ state: "idle" });
    } catch (err) {
      setAdhocDefinition(DEFAULT_SUMMARIESONLY_DEFINITION);
      setAdhocDescription(DEFAULT_SUMMARIESONLY_DESCRIPTION);
      setAdhocStatus({
        state: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  useEffect(() => {
    void loadAdhocMacro();
  }, [loadAdhocMacro]);

  const checkDataModelAcceleration = useCallback(async () => {
    setDataModelReadiness(
      DATA_MODEL_REQUIREMENTS.map((requirement) => ({
        ...requirement,
        state: "checking",
        earliestTime: "",
        message: "Checking acceleration",
      })),
    );

    const readiness = await Promise.all(
      DATA_MODEL_REQUIREMENTS.map(async (requirement) => {
        try {
          return await loadDataModelAcceleration(requirement);
        } catch (err) {
          return {
            ...requirement,
            state: "error" as const,
            earliestTime: "",
            message: err instanceof Error ? err.message : String(err),
          };
        }
      }),
    );
    setDataModelReadiness(readiness);
  }, []);

  useEffect(() => {
    void checkDataModelAcceleration();
  }, [checkDataModelAcceleration]);

  const updateDraftDefinition = useCallback(
    (rowKey: string, definition: string) => {
      const updateRows = (current: EditableMacroRow[]) =>
        current.map((row) =>
          macroStatusKey(row) === rowKey
            ? {
                ...row,
                draftDefinition: definition,
              }
            : row,
        );
      setRows(updateRows);
      setCimRows(updateRows);
      setSaveStatuses((current) => ({
        ...current,
        [rowKey]: { state: "idle" },
      }));
    },
    [],
  );

  const saveOne = useCallback(async (row: EditableMacroRow) => {
    if (row.macro === "unknown") return;
    const definition = row.draftDefinition.trim();
    if (!definition) return;
    setSaveStatuses((current) => ({
      ...current,
      [macroStatusKey(row)]: { state: "saving" },
    }));
    try {
      await saveMacroDefinition(
        row.macro,
        definition,
        row.description,
        row.targetApp,
      );
      setSaveStatuses((current) => ({
        ...current,
        [macroStatusKey(row)]: { state: "saved", message: "Saved" },
      }));
    } catch (err) {
      setSaveStatuses((current) => ({
        ...current,
        [macroStatusKey(row)]: {
          state: "error",
          message: err instanceof Error ? err.message : String(err),
        },
      }));
    }
  }, []);

  const saveAll = useCallback(async () => {
    for (const row of rowsToSave) {
      // Save sequentially so Splunk config writes stay predictable.
      // eslint-disable-next-line no-await-in-loop
      await saveOne(row);
    }
  }, [rowsToSave, saveOne]);

  const finishInitialSetup = useCallback(async () => {
    if (scanState !== "ready") return;
    if (summariesOnlyBlocked) {
      setSetupStatus({
        state: "error",
        message: SUMMARIESONLY_ACCELERATION_ERROR,
      });
      return;
    }
    setSetupStatus({
      state: "saving",
      message: "Saving detected index macros",
    });

    try {
      setSetupStatus({
        state: "saving",
        message: "Saving acceleration mode",
      });
      await saveMacroDefinition(
        ADHOC_MACRO_NAME,
        adhocDefinition.trim(),
        adhocDescription,
        APP_NAME,
      );
      setAdhocStatus({ state: "saved", message: "Saved" });

      setSetupStatus({
        state: "saving",
        message: "Saving detected index macros",
      });
      for (const row of setupRowsToSave) {
        const rowKey = macroStatusKey(row);
        setSaveStatuses((current) => ({
          ...current,
          [rowKey]: { state: "saving" },
        }));
        try {
          // Save sequentially so Splunk configuration writes remain ordered.
          // eslint-disable-next-line no-await-in-loop
          await saveMacroDefinition(
            row.macro,
            row.draftDefinition.trim(),
            row.description,
            APP_NAME,
          );
          setSaveStatuses((current) => ({
            ...current,
            [rowKey]: { state: "saved", message: "Saved" },
          }));
        } catch (saveError) {
          setSaveStatuses((current) => ({
            ...current,
            [rowKey]: {
              state: "error",
              message:
                saveError instanceof Error
                  ? saveError.message
                  : String(saveError),
            },
          }));
          throw saveError;
        }
      }

      setSetupStatus({
        state: "saving",
        message: "Unlocking the app",
      });
      await completeInitialSetup();
      window.location.assign(splunkAppViewUrl(APP_HOME_VIEW));
    } catch (setupError) {
      setSetupStatus({
        state: "error",
        message:
          setupError instanceof Error
            ? setupError.message
            : String(setupError),
      });
    }
  }, [
    adhocDefinition,
    adhocDescription,
    scanState,
    setupRowsToSave,
    summariesOnlyBlocked,
  ]);

  const saveAdhocMacro = useCallback(async () => {
    const definition = adhocDefinition.trim();
    if (!definition) return;
    if (summariesOnlyBlocked) {
      setAdhocStatus({
        state: "error",
        message: SUMMARIESONLY_ACCELERATION_ERROR,
      });
      return;
    }
    setAdhocStatus({ state: "saving" });
    try {
      await saveMacroDefinition(
        ADHOC_MACRO_NAME,
        definition,
        adhocDescription,
        APP_NAME,
      );
      setAdhocStatus({ state: "saved", message: "Saved" });
    } catch (err) {
      setAdhocStatus({
        state: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [adhocDefinition, adhocDescription, summariesOnlyBlocked]);

  const toggleRowGroup = useCallback((targetApp: string) => {
    setCollapsedRowGroups((current) => ({
      ...current,
      [targetApp]: !current[targetApp],
    }));
  }, []);

  const renderEditableRow = (row: EditableMacroRow) => {
    const status = saveStatuses[macroStatusKey(row)] || {
      state: "idle",
    };
    const isUnknown = row.macro === "unknown";
    const isSaving = status.state === "saving";
    return (
      <tr
        key={macroStatusKey(row)}
        className="border-b border-slate-100 align-top"
      >
        <td className="px-4 py-3">
          <div
            className={`font-mono text-sm font-bold ${
              isUnknown ? "text-amber-700" : "text-sky-800"
            }`}
          >
            {row.macro}
          </div>
          <MacroInfoBox macro={row.macro} description={row.description} />
          <div className="mt-1 text-xs text-slate-500">
            {row.sourcetypeCount
              ? `${formatNumber(row.sourcetypeCount)} sourcetypes`
              : "No matching sourcetypes"}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {row.targetApp}/local/macros.conf
          </div>
        </td>
        <td className="px-4 py-3">
          <input
            value={row.draftDefinition}
            onChange={(event) =>
              updateDraftDefinition(macroStatusKey(row), event.target.value)
            }
            disabled={isUnknown}
            className="h-9 w-full rounded border border-slate-300 bg-white px-2 font-mono text-xs text-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
          />
          {status.state === "error" && status.message && (
            <div className="mt-1 text-xs text-red-700">{status.message}</div>
          )}
          {status.state === "saved" && (
            <div className="mt-1 text-xs font-semibold text-emerald-700">
              Saved
            </div>
          )}
        </td>
        <td className="px-4 py-3">
          <FieldPills
            values={row.indexes}
            tone="sky"
            expandable
            valueLabel="indexes"
          />
        </td>
        <td className="px-4 py-3">
          <FieldPills
            values={row.sourcetypes}
            expandable
            valueLabel="sourcetypes"
          />
        </td>
        <td className="px-4 py-3 text-right font-mono text-sm text-slate-700">
          {formatNumber(row.events)}
        </td>
        <td className="px-4 py-3 text-right">
          <button
            type="button"
            onClick={() => saveOne(row)}
            disabled={isUnknown || isSaving || !row.draftDefinition.trim()}
            className={`${compactButtonBase} border-slate-300 bg-white text-slate-700 hover:border-emerald-500 hover:text-emerald-700`}
          >
            {isSaving ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Save size={15} />
            )}
            Save
          </button>
        </td>
      </tr>
    );
  };

  const renderTableRows = (rowGroups: RowGroup[]) =>
    rowGroups.map(({ targetApp, rows: appRows }) => {
      const isCollapsed = Boolean(collapsedRowGroups[targetApp]);
      return (
        <React.Fragment key={targetApp}>
          <tr className="border-b border-slate-200 bg-slate-100">
            <td colSpan={6} className="p-0">
              <button
                type="button"
                onClick={() => toggleRowGroup(targetApp)}
                aria-expanded={!isCollapsed}
                className="flex h-9 w-full items-center gap-2 px-4 text-left text-xs font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-200"
              >
                {isCollapsed ? (
                  <ChevronRight size={15} className="shrink-0" />
                ) : (
                  <ChevronDown size={15} className="shrink-0" />
                )}
                <span className="min-w-0 truncate">
                  {targetApp}/local/macros.conf
                </span>
                <span className="ml-auto shrink-0 rounded bg-white px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-slate-500">
                  {formatNumber(appRows.length)} macros
                </span>
              </button>
            </td>
          </tr>
          {!isCollapsed && appRows.map(renderEditableRow)}
        </React.Fragment>
      );
    });

  return (
    <main
      className={`min-h-screen bg-[#f4f6f8] px-6 py-5 text-slate-800 ${
        setupMode ? "pb-28" : ""
      }`}
    >
      {setupMode && (
        <section className="mb-4 border border-sky-300 bg-sky-50">
          <div className="px-5 py-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-sky-800">
                Initial setup · Step 3 of 3
              </div>
              <h1 className="mt-1 text-lg font-bold text-slate-900">
                Tune the indexes discovered for your Cisco data
              </h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-700">
                The fast scan runs automatically. Review the proposed{" "}
                <code className="rounded bg-white px-1 py-0.5 font-mono text-xs">
                  index_*
                </code>{" "}
                definitions, edit them if needed, then finish setup. Finishing
                saves detected SCD index macros and unlocks the landing page;
                optional CIM and external-app macros can be tuned later.
              </p>
              {setupStatus.state === "error" && setupStatus.message && (
                <div
                  role="alert"
                  className="mt-3 flex items-start gap-2 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                >
                  <AlertTriangle className="mt-0.5 shrink-0" size={16} />
                  <span>{setupStatus.message}</span>
                </div>
              )}
            </div>
          </div>
          <ol className="grid grid-cols-3 border-t border-sky-200 text-xs font-bold text-slate-600">
            <li className="flex min-h-10 items-center gap-2 border-r border-sky-200 bg-emerald-50 px-4 text-emerald-800">
              <Check size={14} /> Discover data
            </li>
            <li className="flex min-h-10 items-center gap-2 border-r border-sky-200 bg-emerald-50 px-4 text-emerald-800">
              <Check size={14} /> Validate add-ons
            </li>
            <li className="flex min-h-10 items-center gap-2 bg-sky-100 px-4 text-sky-900">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-sky-700 text-[10px] text-white">
                3
              </span>
              Tune indexes
            </li>
          </ol>
        </section>
      )}
      {setupMode && (
        <section
          aria-label="Initial setup actions"
          className="fixed bottom-0 left-0 right-0 z-[80] flex flex-wrap items-center justify-between gap-3 border-t border-slate-300 bg-white px-6 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.16)] md:left-[72px]"
        >
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-sky-800">
              Step 3 of 3 · Tune indexes
            </div>
            <div className="mt-0.5 text-sm text-slate-600">
              {summariesOnlyBlocked
                ? "Enable acceleration for the required Cisco data models before finishing."
                : scanState !== "ready"
                  ? "Waiting for the automatic index scan to finish."
                  : `${setupRowsToSave.length} detected index macro${
                      setupRowsToSave.length === 1 ? "" : "s"
                    } will be saved when setup finishes.`}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={splunkAppViewUrl(APP_SETUP_VIEW)}
              className={`${lightButtonBase} border-slate-300 bg-white text-slate-700 hover:border-sky-400 hover:text-sky-700`}
            >
              <ArrowLeft size={16} />
              Back
            </a>
            <button
              type="button"
              onClick={finishInitialSetup}
              disabled={
                scanState !== "ready" ||
                setupStatus.state === "saving" ||
                isSavingAll ||
                summariesOnlyBlocked
              }
              className={`${lightButtonBase} border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700`}
            >
              {setupStatus.state === "saving" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              {setupStatus.state === "saving"
                ? setupStatus.message || "Finishing setup"
                : "Finish setup"}
            </button>
          </div>
        </section>
      )}
      <section className="mb-4 border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="m-0 text-xl font-bold tracking-normal text-slate-900">
              Macro Index Tuning
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Scan known Cisco sourcetypes for fast dashboard macro tuning. SCD{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">
                index_*
              </code>{" "}
              macros are discovered from this app at runtime, so new index
              macros are picked up automatically. Run CIM data model discovery
              separately when you need the slower tag-based index search.
            </p>
            <p className="mt-1 max-w-3xl text-xs text-slate-500">
              Powered by searchbase entry{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">
                {TUNING_SEARCHBASE_ID}
              </code>
              .
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-10 items-center gap-3 text-sm font-semibold text-slate-700">
              <span>Range</span>
              <TimeRangeDropdown
                earliest={timeRange.earliest}
                latest={timeRange.latest}
                onChange={handleFastTimeRangeChange}
                realTimeDisabled
                presets={TIME_PRESETS}
                onRequestParseEarliest={
                  fastTimeParser.handleRequestParseEarliest
                }
                onRequestParseLatest={fastTimeParser.handleRequestParseLatest}
                parseEarliest={fastTimeParser.parseEarliest}
                parseLatest={fastTimeParser.parseLatest}
                labelMaxChars={32}
              />
            </div>
            <button
              type="button"
              onClick={runScan}
              disabled={isLoading}
              className={`${lightButtonBase} border-sky-600 bg-sky-600 text-white hover:bg-sky-700`}
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Play size={16} />
              )}
              {isLoading ? "Running" : "Run fast scan"}
            </button>
            <a
              href={openSearchUrl || undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!openSearchUrl}
              className={`${lightButtonBase} border-slate-300 bg-white text-slate-700 hover:border-sky-400 hover:text-sky-700 ${
                openSearchUrl ? "" : "pointer-events-none opacity-55"
              }`}
            >
              <ExternalLink size={16} />
              Open in Search
            </a>
            <button
              type="button"
              onClick={saveAll}
              disabled={
                !rowsToSave.length || isLoading || isCimLoading || isSavingAll
              }
              className={`${lightButtonBase} border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700`}
            >
              {isSavingAll ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Save all
            </button>
          </div>
        </div>
      </section>

      <section className="mb-4 border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="m-0 text-base font-bold text-slate-900">
              Ad hoc macro
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Choose whether data-model searches may use raw events.{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">
                summariesonly=true
              </code>{" "}
              reads accelerated summaries only and requires acceleration on all
              three Cisco data models listed below.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void loadAdhocMacro();
              void checkDataModelAcceleration();
            }}
            disabled={
              adhocStatus.state === "saving" || accelerationCheckInProgress
            }
            className={`${lightButtonBase} border-slate-300 bg-white text-slate-700 hover:border-sky-400 hover:text-sky-700`}
          >
            <RefreshCw
              size={16}
              className={
                adhocStatus.state === "saving" || accelerationCheckInProgress
                  ? "animate-spin"
                  : ""
              }
            />
            Refresh
          </button>
        </div>
        <div className="grid gap-3 px-4 py-4 lg:grid-cols-[180px_minmax(0,1fr)_auto] lg:items-start">
          <div>
            <div className="font-mono text-sm font-bold text-sky-800">
              {ADHOC_MACRO_NAME}
            </div>
            <MacroInfoBox
              macro={ADHOC_MACRO_NAME}
              description={adhocDescription}
            />
            <div className="mt-1 text-xs text-slate-500">
              tstats acceleration options
            </div>
          </div>
          <div>
            <input
              aria-label={`${ADHOC_MACRO_NAME} definition`}
              value={adhocDefinition}
              onChange={(event) => {
                setAdhocDefinition(event.target.value);
                setAdhocStatus({ state: "idle" });
              }}
              className="h-9 w-full rounded border border-slate-300 bg-white px-2 font-mono text-xs text-slate-900"
            />
            {adhocStatus.state === "error" && adhocStatus.message && (
              <div className="mt-1 text-xs text-red-700">
                {adhocStatus.message}
              </div>
            )}
            {adhocStatus.state === "saved" && (
              <div className="mt-1 text-xs font-semibold text-emerald-700">
                Saved
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={saveAdhocMacro}
            disabled={
              adhocStatus.state === "saving" ||
              !adhocDefinition.trim() ||
              summariesOnlyBlocked
            }
            className={`${lightButtonBase} border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700`}
          >
            {adhocStatus.state === "saving" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            Save
          </button>
        </div>
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="m-0 text-sm font-bold text-slate-900">
                Data model acceleration readiness
              </h3>
              <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-600">
                Cisco Catalyst, Cisco Security, and Cisco ThousandEyes are
                required for{" "}
                <code className="rounded bg-white px-1 py-0.5 font-mono">
                  summariesonly=true
                </code>
                . Authentication and Network Traffic acceleration are strongly
                recommended.
              </p>
            </div>
            <button
              type="button"
              onClick={checkDataModelAcceleration}
              disabled={accelerationCheckInProgress}
              className={`${compactButtonBase} border-slate-300 bg-white text-slate-700 hover:border-sky-400 hover:text-sky-700`}
            >
              <RefreshCw
                size={14}
                className={
                  accelerationCheckInProgress ? "animate-spin" : ""
                }
              />
              Check again
            </button>
          </div>

          <div
            className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5"
            role="list"
            aria-label="Data model acceleration requirements"
          >
            {dataModelReadiness.map((item) => {
              const enabled = item.state === "enabled";
              const checking = item.state === "checking";
              const required = item.priority === "required";
              return (
                <div
                  key={item.key}
                  role="listitem"
                  className={`border bg-white px-3 py-3 ${
                    enabled
                      ? "border-emerald-200"
                      : checking
                        ? "border-slate-200"
                        : required
                          ? "border-red-200"
                          : "border-amber-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-slate-900">
                      {item.label}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        required
                          ? "bg-sky-100 text-sky-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {required ? "Required" : "Strongly recommended"}
                    </span>
                  </div>
                  <code className="mt-2 block break-all font-mono text-[11px] text-slate-500">
                    {item.model}
                  </code>
                  <div
                    className={`mt-3 flex items-start gap-2 text-xs font-semibold ${
                      enabled
                        ? "text-emerald-700"
                        : checking
                          ? "text-slate-600"
                          : required
                            ? "text-red-700"
                            : "text-amber-800"
                    }`}
                  >
                    {checking ? (
                      <Loader2
                        className="mt-0.5 shrink-0 animate-spin"
                        size={14}
                      />
                    ) : enabled ? (
                      <Check className="mt-0.5 shrink-0" size={14} />
                    ) : (
                      <AlertTriangle
                        className="mt-0.5 shrink-0"
                        size={14}
                      />
                    )}
                    <span>{item.message}</span>
                  </div>
                  {enabled && item.earliestTime && (
                    <div className="mt-1 text-[11px] text-slate-500">
                      Acceleration range: {item.earliestTime}
                    </div>
                  )}
                  <a
                    href={splunkAppManagerUrl(
                      item.app,
                      "data_model_manager",
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:text-sky-900"
                  >
                    Open data models
                    <ExternalLink size={12} />
                  </a>
                </div>
              );
            })}
          </div>

          {summariesOnlyEnabled && accelerationCheckInProgress ? (
            <div
              role="status"
              className="mt-3 flex items-start gap-2 border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800"
            >
              <Loader2 className="mt-0.5 shrink-0 animate-spin" size={16} />
              Checking the required data-model acceleration settings.
            </div>
          ) : summariesOnlyBlocked ? (
            <div
              role="alert"
              className="mt-3 flex items-start gap-2 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              <AlertTriangle className="mt-0.5 shrink-0" size={16} />
              <span>
                <code className="font-mono">summariesonly=true</code> cannot
                be saved yet. Enable acceleration for all three required Cisco
                data models, then check again.
              </span>
            </div>
          ) : summariesOnlyEnabled ? (
            <div
              role="status"
              className="mt-3 flex items-start gap-2 border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
            >
              <Check className="mt-0.5 shrink-0" size={16} />
              All required Cisco data models have acceleration enabled.
            </div>
          ) : (
            <div className="mt-3 flex items-start gap-2 border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <Info className="mt-0.5 shrink-0 text-sky-700" size={16} />
              <span>
                <code className="font-mono">summariesonly=false</code> may
                fall back to raw events while acceleration is being prepared.
              </span>
            </div>
          )}
        </div>
      </section>

      <section className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <div className="border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Macros
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900">
            {formatNumber(tunableRows.length)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            tunable index macros
          </div>
        </div>
        <div className="border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Index values
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900">
            {formatNumber(totalIndexValues)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            SCD macro definitions
          </div>
        </div>
        <div className="border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            CIM indexes
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900">
            {formatNumber(totalCimIndexValues)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Splunk_SA_CIM definitions
          </div>
        </div>
        <div className="border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Model indexes
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900">
            {formatNumber(totalModelIndexValues)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Cisco model app definitions
          </div>
        </div>
        <div className="border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Events
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900">
            {formatNumber(totalEvents)}
          </div>
          <div className="mt-1 text-xs text-slate-500">matched by the scan</div>
        </div>
        <div className="border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Unknown
          </div>
          <div
            className={`mt-1 text-2xl font-bold ${hasUnknown ? "text-amber-700" : "text-emerald-700"}`}
          >
            {formatNumber(rows.filter((row) => row.macro === "unknown").length)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            unmapped sourcetype groups
          </div>
        </div>
      </section>

      {error && (
        <section className="mb-4 flex items-start gap-2 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 shrink-0" size={17} />
          <div>
            <div className="font-bold">Macro tuning scan failed.</div>
            <div>{error}</div>
          </div>
        </section>
      )}

      {hasUnknown && (
        <section className="mb-4 flex items-start gap-2 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 shrink-0" size={17} />
          <div>
            <div className="font-bold">
              One or more sourcetypes were classified as unknown.
            </div>
            <div>
              Review those rows before saving so high-volume data does not keep
              falling back to broad searches.
            </div>
          </div>
        </section>
      )}

      <section className="mb-4 border border-slate-200 bg-white">
        <div className="grid gap-3 border-b border-slate-200 px-4 py-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex shrink-0 items-center gap-2">
              <Search size={17} className="text-sky-700" />
              <h2 className="m-0 text-base font-bold text-slate-900">
                Fast macro definitions
              </h2>
            </div>
            <label
              htmlFor="macro-index-tuning-search"
              className="relative min-w-0 w-full sm:min-w-[260px] sm:max-w-[420px]"
            >
              <span className="sr-only">
                Search macro, definition, indexes, and sourcetypes
              </span>
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="macro-index-tuning-search"
                type="search"
                value={filterText}
                onChange={(event) => setFilterText(event.target.value)}
                placeholder="Search macro, definition, indexes, sourcetypes"
                className={tableSearchInputBase}
              />
            </label>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2 xl:justify-end">
            <CopyButton
              text={macroStanzas}
              label="Copy macros.conf"
              targetRef={macroPreviewRef}
            />
            <a
              href={macrosManagerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${lightButtonBase} border-slate-300 bg-white text-slate-700 hover:border-sky-400 hover:text-sky-700`}
            >
              <ExternalLink size={16} />
              Open SCD macros
            </a>
            {externalMacroManagerLinks.map(({ targetApp, href }) => (
              <a
                key={targetApp}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={`${lightButtonBase} border-slate-300 bg-white text-slate-700 hover:border-sky-400 hover:text-sky-700`}
              >
                <ExternalLink size={16} />
                Open {getTargetAppLabel(targetApp)} macros
              </a>
            ))}
          </div>
        </div>

        {isLoading && rows.length === 0 ? (
          <div className="flex min-h-[260px] items-center justify-center gap-3 text-sm text-slate-600">
            <Loader2 size={18} className="animate-spin text-sky-700" />
            Scanning indexes and sourcetypes...
          </div>
        ) : rows.length === 0 ? (
          <div className="min-h-[220px] px-4 py-12 text-center text-sm text-slate-500">
            No macro rows returned for the selected range.
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="min-h-[220px] px-4 py-12 text-center text-sm text-slate-500">
            No macro rows match the current search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="w-[190px] px-4 py-3 font-bold">Macro</th>
                  <th className="min-w-[330px] px-4 py-3 font-bold">
                    Definition
                  </th>
                  <th className="min-w-[220px] px-4 py-3 font-bold">Indexes</th>
                  <th className="min-w-[260px] px-4 py-3 font-bold">
                    Sourcetypes
                  </th>
                  <th className="w-[110px] px-4 py-3 text-right font-bold">
                    Events
                  </th>
                  <th className="w-[130px] px-4 py-3 text-right font-bold">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>{renderTableRows(filteredRowGroups)}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mb-4 border border-slate-200 bg-white">
        <div className="grid gap-3 border-b border-slate-200 px-4 py-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => toggleRowGroup(CIM_APP_NAME)}
              aria-expanded={!isCimGroupCollapsed}
              className="flex h-9 max-w-full items-center gap-2 text-left text-xs font-bold uppercase tracking-wide text-slate-600 hover:text-sky-700"
            >
              {isCimGroupCollapsed ? (
                <ChevronRight size={15} className="shrink-0" />
              ) : (
                <ChevronDown size={15} className="shrink-0" />
              )}
              <span className="min-w-0 truncate">
                {CIM_APP_NAME}/local/macros.conf
              </span>
              <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-slate-500">
                {formatNumber(cimMacroRows.length)} macros
              </span>
            </button>
            {!isCimGroupCollapsed && (
              <p className="mt-1 text-sm text-slate-600">
                CIM data model discovery. Discover Splunk_SA_CIM index macros
                with tag-based searches only when needed.
              </p>
            )}
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2 xl:justify-end">
            <div className="flex h-10 items-center gap-2 text-sm font-semibold text-slate-700">
              <span>CIM range</span>
              <TimeRangeDropdown
                earliest={cimTimeRange.earliest}
                latest={cimTimeRange.latest}
                onChange={handleCimTimeRangeChange}
                realTimeDisabled
                presets={TIME_PRESETS}
                onRequestParseEarliest={
                  cimTimeParser.handleRequestParseEarliest
                }
                onRequestParseLatest={cimTimeParser.handleRequestParseLatest}
                parseEarliest={cimTimeParser.parseEarliest}
                parseLatest={cimTimeParser.parseLatest}
                labelMaxChars={28}
              />
            </div>
            <button
              type="button"
              onClick={runCimDiscovery}
              disabled={isCimLoading}
              className={`${lightButtonBase} border-sky-600 bg-sky-600 text-white hover:bg-sky-700`}
            >
              {isCimLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Play size={16} />
              )}
              {isCimLoading ? "Running" : "Run CIM discovery"}
            </button>
            <a
              href={openCimSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${lightButtonBase} border-slate-300 bg-white text-slate-700 hover:border-sky-400 hover:text-sky-700`}
            >
              <ExternalLink size={16} />
              Open CIM Search
            </a>
          </div>
        </div>

        {!isCimGroupCollapsed && (
          <>
            {cimError && (
              <div className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <AlertTriangle className="mt-0.5 shrink-0" size={17} />
                <div>
                  <div className="font-bold">CIM discovery failed.</div>
                  <div>{cimError}</div>
                </div>
              </div>
            )}

            {isCimLoading && cimRows.length === 0 ? (
              <div className="flex min-h-[180px] items-center justify-center gap-3 text-sm text-slate-600">
                <Loader2 size={18} className="animate-spin text-sky-700" />
                Discovering CIM indexes...
              </div>
            ) : cimRows.length === 0 ? (
              <div className="min-h-[160px] px-4 py-12 text-center text-sm text-slate-500">
                No CIM macro rows loaded.
              </div>
            ) : filteredCimRows.length === 0 ? (
              <div className="min-h-[160px] px-4 py-12 text-center text-sm text-slate-500">
                No CIM macro rows match the current search.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <th className="w-[190px] px-4 py-3 font-bold">Macro</th>
                      <th className="min-w-[330px] px-4 py-3 font-bold">
                        Definition
                      </th>
                      <th className="min-w-[220px] px-4 py-3 font-bold">
                        Indexes
                      </th>
                      <th className="min-w-[260px] px-4 py-3 font-bold">
                        Sourcetypes
                      </th>
                      <th className="w-[110px] px-4 py-3 text-right font-bold">
                        Events
                      </th>
                      <th className="w-[130px] px-4 py-3 text-right font-bold">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>{filteredCimRows.map(renderEditableRow)}</tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
        <div className="border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="m-0 text-base font-bold text-slate-900">
              macros.conf preview
            </h2>
          </div>
          <textarea
            ref={macroPreviewRef}
            readOnly
            value={
              macroStanzas || "# Run the scan to populate macro definitions."
            }
            aria-label="macros.conf preview"
            className="m-0 h-[320px] w-full resize-y overflow-auto border-0 bg-white p-4 font-mono text-xs leading-relaxed text-slate-800 outline-none"
          />
        </div>

        <div className="grid gap-4">
          <details className="border border-slate-200 bg-white">
            <summary className="cursor-pointer border-b border-slate-200 px-4 py-3 text-base font-bold text-slate-900">
              Fast scan SPL
            </summary>
            <pre className="m-0 max-h-[220px] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed text-slate-800">
              {searchSpl || "# Loading searchbase SPL..."}
            </pre>
          </details>

          <details className="border border-slate-200 bg-white">
            <summary className="cursor-pointer border-b border-slate-200 px-4 py-3 text-base font-bold text-slate-900">
              CIM discovery SPL
            </summary>
            <pre className="m-0 max-h-[220px] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed text-slate-800">
              {CIM_DISCOVERY_SEARCH}
            </pre>
          </details>
        </div>
      </section>
    </main>
  );
}
