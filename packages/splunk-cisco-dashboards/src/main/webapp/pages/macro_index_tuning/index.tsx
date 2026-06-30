import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  Check,
  ClipboardCopy,
  ExternalLink,
  Loader2,
  Play,
  RefreshCw,
  Save,
  Search,
} from "lucide-react";
import { getDefaultFetchInit } from "@splunk/splunk-utils/fetch";

import {
  getSearchAppContext,
  isAbortError,
  runSearch,
} from "@/common/services/splunkSearchService";
import { getSearchbaseCatalogue } from "@/common/services/searchbaseCatalogue";
import { splunkSearchAppUrl } from "@/common/lib/splunkSearchUrl";

const APP_NAME = "splunk-cisco-dashboards";
const CIM_APP_NAME = "Splunk_SA_CIM";
const CISCO_SECURITY_APP_NAME = "CiscoSecurityCloud";
const THOUSAND_EYES_APP_NAME = "ta_cisco_thousandeyes";
const TUNING_SEARCHBASE_ID = "admin_macro_index_tuning";
const TUNING_SEARCH_NAME = "Admin - Macro Index Tuning";
const ADHOC_MACRO_NAME = "scd_summariesonly";
const DEFAULT_SUMMARIESONLY_DEFINITION =
  "summariesonly=false allow_old_summaries=false fillnull_value=null";
const DEFAULT_INDEX_IN_DEFINITION = "index IN (*)";
const DEFAULT_INDEX_OR_DEFINITION = "(index=*)";
const INDEX_MACRO_NAMES = [
  "index_catalyst",
  "index_firewall",
  "index_identity",
  "index_windows",
  "index_network",
  "index_zeek",
  "index_meraki",
  "index_spaces",
  "index_security",
  "index_dhcp",
  "index_thousandeyes",
  "index_f5",
  "index_duo",
  "index_cybervision",
  "index_ucs",
  "index_sdwan",
  "index_dc",
  "index_nvm",
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
  CIM_APP_NAME,
  CISCO_SECURITY_APP_NAME,
  THOUSAND_EYES_APP_NAME,
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

type ScanState = "idle" | "loading" | "ready" | "error";
type SaveState = "idle" | "saving" | "saved" | "error";
type CopyState = "idle" | "copied" | "selected" | "error";
type DefinitionFormat = "indexIn" | "indexOr";

interface TunableMacroConfig {
  macro: string;
  targetApp: string;
  definitionFormat: DefinitionFormat;
  definitionSuffix?: string;
  family: "scd" | "cim" | "ciscoSecurity" | "thousandEyes";
}

const INDEX_MACRO_CONFIGS: TunableMacroConfig[] = INDEX_MACRO_NAMES.map(
  (macro) => ({
    macro,
    targetApp: APP_NAME,
    definitionFormat: "indexIn",
    family: "scd",
  }),
);
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
const TUNABLE_MACRO_CONFIGS: TunableMacroConfig[] = [
  ...INDEX_MACRO_CONFIGS,
  ...CIM_MACRO_CONFIGS,
  ...CISCO_SECURITY_MODEL_MACRO_CONFIGS,
  ...THOUSAND_EYES_MODEL_MACRO_CONFIGS,
];
const TUNABLE_MACRO_NAME_SET = new Set<string>(
  TUNABLE_MACRO_CONFIGS.map((config) => config.macro),
);
const INDEX_MACRO_NAME_SET = new Set<string>(INDEX_MACRO_NAMES);
const MACRO_CONFIG_BY_NAME = new Map<string, TunableMacroConfig>(
  TUNABLE_MACRO_CONFIGS.map((config) => [config.macro, config]),
);

interface MacroRow {
  macro: string;
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

interface SaveStatus {
  state: SaveState;
  message?: string;
}

const TIME_RANGE_OPTIONS = [
  { value: "-24h@h", label: "Last 24 hours" },
  { value: "-7d@d", label: "Last 7 days" },
  { value: "-30d@d", label: "Last 30 days" },
  { value: "0", label: "All time" },
];

const lightButtonBase =
  "inline-flex h-10 min-h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold leading-none transition disabled:cursor-not-allowed disabled:opacity-55";
const compactButtonBase =
  "inline-flex h-8 min-h-8 items-center justify-center gap-2 rounded border px-3 text-sm font-semibold leading-none transition disabled:cursor-not-allowed disabled:opacity-55";
const toolbarSelectBase =
  "mb-0 block h-10 min-h-10 rounded-md border border-slate-300 bg-white px-3 pr-9 text-sm font-normal leading-none text-slate-800";
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
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeNumber = (value: unknown): number => {
  const parsed = Number(normalizeText(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const getMacroConfig = (macro: string): TunableMacroConfig | undefined =>
  MACRO_CONFIG_BY_NAME.get(macro);

const getTargetAppLabel = (targetApp: string): string =>
  TARGET_APP_LABELS[targetApp] || targetApp;

const normalizeDefinitionFormat = (value: unknown): DefinitionFormat => {
  const normalized = normalizeText(value).trim();
  return normalized === "indexOr" ? "indexOr" : "indexIn";
};

const parseSearchResult = (row: Record<string, unknown>): MacroRow | null => {
  const macro = normalizeText(row.macro).trim();
  if (!macro) return null;
  const config = getMacroConfig(macro);
  const rowTargetApp = normalizeText(row.target_app ?? row.app).trim();
  return {
    macro,
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
  const suffix = definitionSuffix.trim()
    ? ` ${definitionSuffix.trim()}`
    : "";
  if (!tokens.length) {
    const defaultDefinition = definitionFormat === "indexOr"
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
): string =>
  rows
    .filter(
      (row) =>
        row.targetApp === targetApp &&
        TUNABLE_MACRO_NAME_SET.has(row.macro) &&
        row.draftDefinition.trim(),
    )
    .map(
      (row) =>
        `[${row.macro}]\ndefinition = ${row.draftDefinition.trim()}\niseval = 0`,
    )
    .join("\n\n");

const buildMacroStanza = (macro: string, definition: string): string =>
  definition.trim()
    ? `[${macro}]\ndefinition = ${definition.trim()}\niseval = 0`
    : "";

const macroStatusKey = (row: Pick<EditableMacroRow, "targetApp" | "macro">) =>
  `${row.targetApp}:${row.macro}`;

const rowMatchesFilter = (row: EditableMacroRow, terms: string[]): boolean => {
  if (!terms.length) return true;
  const haystack = [
    row.macro,
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

const saveMacroDefinition = async (
  macro: string,
  definition: string,
  targetApp = APP_NAME,
): Promise<void> => {
  const response = await fetch(macroConfigUrl(macro, targetApp), {
    ...getDefaultFetchInit(),
    method: "POST",
    body: new URLSearchParams({
      definition,
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

const loadMacroDefinition = async (
  macro: string,
  targetApp = APP_NAME,
): Promise<string> => {
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
    payload as { entry?: Array<{ content?: { definition?: unknown } }> } | null
  )?.entry;
  const definition = entries?.[0]?.content?.definition;
  return typeof definition === "string" ? definition : "";
};

const loadMacroDefinitions = async (
  configs: readonly TunableMacroConfig[],
): Promise<Record<string, string>> => {
  const pairs = await Promise.all(
    configs.map(async (config) => {
      try {
        return [
          `${config.targetApp}:${config.macro}`,
          await loadMacroDefinition(config.macro, config.targetApp),
        ] as const;
      } catch {
        return [`${config.targetApp}:${config.macro}`, ""] as const;
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
}: {
  values: string[];
  tone?: "slate" | "sky";
  expandable?: boolean;
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
          title={`Show ${extra} more sourcetypes`}
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

export default function MacroIndexTuningPage(): JSX.Element {
  const [rows, setRows] = useState<EditableMacroRow[]>([]);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [error, setError] = useState<string>("");
  const [searchSpl, setSearchSpl] = useState<string>("");
  const [timeRange, setTimeRange] = useState(TIME_RANGE_OPTIONS[2].value);
  const [filterText, setFilterText] = useState("");
  const [saveStatuses, setSaveStatuses] = useState<Record<string, SaveStatus>>(
    {},
  );
  const [adhocDefinition, setAdhocDefinition] = useState(
    DEFAULT_SUMMARIESONLY_DEFINITION,
  );
  const [adhocStatus, setAdhocStatus] = useState<SaveStatus>({ state: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const searchSplRef = useRef<string>("");
  const macroPreviewRef = useRef<HTMLTextAreaElement>(null);

  const generatedMacroStanzasByApp = useMemo<Record<string, string>>(
    () =>
      Object.fromEntries(
        TARGET_APP_ORDER.map((targetApp) => [
          targetApp,
          buildMacroStanzas(rows, targetApp),
        ]),
      ),
    [rows],
  );
  const macroStanzas = useMemo(
    () => {
      const sections = TARGET_APP_ORDER.flatMap((targetApp) => {
        const parts = [
          targetApp === APP_NAME
            ? buildMacroStanza(ADHOC_MACRO_NAME, adhocDefinition)
            : "",
          generatedMacroStanzasByApp[targetApp] || "",
        ].filter(Boolean);
        return parts.length
          ? [`# ${targetApp}/local/macros.conf\n${parts.join("\n\n")}`]
          : [];
      });
      return sections.join("\n\n");
    },
    [adhocDefinition, generatedMacroStanzasByApp],
  );
  const hasUnknown = rows.some((row) => row.macro === "unknown");
  const tunableRows = rows.filter((row) =>
    TUNABLE_MACRO_NAME_SET.has(row.macro),
  );
  const indexMacroRows = tunableRows.filter((row) =>
    INDEX_MACRO_NAME_SET.has(row.macro),
  );
  const cimMacroRows = tunableRows.filter(
    (row) => row.targetApp === CIM_APP_NAME,
  );
  const modelMacroRows = tunableRows.filter(
    (row) =>
      row.targetApp === CISCO_SECURITY_APP_NAME ||
      row.targetApp === THOUSAND_EYES_APP_NAME,
  );
  const rowsToSave = tunableRows.filter((row) => row.draftDefinition.trim());
  const filterTerms = useMemo(
    () => filterText.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [filterText],
  );
  const filteredRows = useMemo(
    () => rows.filter((row) => rowMatchesFilter(row, filterTerms)),
    [filterTerms, rows],
  );
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
  const isSavingAll = Object.values(saveStatuses).some(
    (status) => status.state === "saving",
  );
  const openSearchUrl = searchSpl
    ? splunkSearchAppUrl(searchSpl, { earliest: timeRange, latest: "now" })
    : "";
  const macrosManagerUrl = splunkManagerUrl("data/macros");
  const externalMacroManagerLinks = TARGET_APP_ORDER.filter(
    (targetApp) => targetApp !== APP_NAME,
  ).map((targetApp) => ({
    targetApp,
    href: splunkAppManagerUrl(targetApp, "data/macros"),
  }));

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
      const spl = await loadTuningSearch();
      const result = await runSearch({
        spl,
        earliestTime: timeRange,
        latestTime: "now",
        count: 0,
        tag: TUNING_SEARCHBASE_ID,
        signal: controller.signal,
      });
      const currentDefinitions =
        await loadMacroDefinitions(TUNABLE_MACRO_CONFIGS);
      const parsed = ((result.results || []) as Record<string, unknown>[])
        .map(parseSearchResult)
        .filter((row): row is MacroRow => Boolean(row))
        .map((row) => ({
          ...row,
          draftDefinition: row.definition,
        }));
      const scannedByMacro = new Map(
        parsed.map((row) => [macroStatusKey(row), row]),
      );
      const expectedRows = TUNABLE_MACRO_CONFIGS.map((config) => {
        const scanned = scannedByMacro.get(
          `${config.targetApp}:${config.macro}`,
        );
        const fallbackDefinition =
          currentDefinitions[`${config.targetApp}:${config.macro}`] ||
          scanned?.definition ||
          formatIndexDefinition(
            [],
            config.definitionFormat,
            config.definitionSuffix,
          );
        const draftDefinition = scanned?.definition || fallbackDefinition;

        return {
          macro: config.macro,
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
      const extraRows = parsed
        .filter((row) => !TUNABLE_MACRO_NAME_SET.has(row.macro))
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
  }, [loadTuningSearch, timeRange]);

  useEffect(() => {
    void runScan();
    return () => {
      abortRef.current?.abort();
    };
  }, [runScan]);

  const loadAdhocMacro = useCallback(async () => {
    setAdhocStatus({ state: "saving", message: "Loading current macro" });
    try {
      const definition = await loadMacroDefinition(ADHOC_MACRO_NAME, APP_NAME);
      setAdhocDefinition(definition || DEFAULT_SUMMARIESONLY_DEFINITION);
      setAdhocStatus({ state: "idle" });
    } catch (err) {
      setAdhocDefinition(DEFAULT_SUMMARIESONLY_DEFINITION);
      setAdhocStatus({
        state: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  useEffect(() => {
    void loadAdhocMacro();
  }, [loadAdhocMacro]);

  const updateDraftDefinition = useCallback(
    (rowKey: string, definition: string) => {
      setRows((current) =>
        current.map((row) =>
          macroStatusKey(row) === rowKey
            ? {
                ...row,
                draftDefinition: definition,
              }
            : row,
        ),
      );
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
      await saveMacroDefinition(row.macro, definition, row.targetApp);
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

  const saveAdhocMacro = useCallback(async () => {
    const definition = adhocDefinition.trim();
    if (!definition) return;
    setAdhocStatus({ state: "saving" });
    try {
      await saveMacroDefinition(ADHOC_MACRO_NAME, definition, APP_NAME);
      setAdhocStatus({ state: "saved", message: "Saved" });
    } catch (err) {
      setAdhocStatus({
        state: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [adhocDefinition]);

  return (
    <main className="min-h-screen bg-[#f4f6f8] px-6 py-5 text-slate-800">
      <section className="mb-4 border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="m-0 text-xl font-bold tracking-normal text-slate-900">
              Macro Index Tuning
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Scan your Splunk indexes for Cisco and related sourcetypes, map
              the detected data into the dashboard index macros and selected
              data model app macros, then review and save the generated macro
              definitions so searches run against the right indexes.
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
            <label
              htmlFor="macro-index-tuning-range"
              className="mb-0 flex h-10 items-center gap-3 text-sm font-semibold text-slate-700"
            >
              Range
              <select
                id="macro-index-tuning-range"
                value={timeRange}
                onChange={(event) => setTimeRange(event.target.value)}
                className={`${toolbarSelectBase} w-[220px]`}
              >
                {TIME_RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
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
              {isLoading ? "Running" : "Run scan"}
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
              disabled={!rowsToSave.length || isLoading || isSavingAll}
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
              Update{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">
                {ADHOC_MACRO_NAME}
              </code>{" "}
              before saving generated index macros.
            </p>
          </div>
          <button
            type="button"
            onClick={loadAdhocMacro}
            disabled={adhocStatus.state === "saving"}
            className={`${lightButtonBase} border-slate-300 bg-white text-slate-700 hover:border-sky-400 hover:text-sky-700`}
          >
            <RefreshCw
              size={16}
              className={adhocStatus.state === "saving" ? "animate-spin" : ""}
            />
            Reload
          </button>
        </div>
        <div className="grid gap-3 px-4 py-4 lg:grid-cols-[180px_minmax(0,1fr)_auto] lg:items-start">
          <div>
            <div className="font-mono text-sm font-bold text-sky-800">
              {ADHOC_MACRO_NAME}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              tstats acceleration options
            </div>
          </div>
          <div>
            <input
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
            disabled={adhocStatus.state === "saving" || !adhocDefinition.trim()}
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
                Generated macro definitions
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
              <tbody>
                {filteredRows.map((row) => {
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
                            updateDraftDefinition(
                              macroStatusKey(row),
                              event.target.value,
                            )
                          }
                          disabled={isUnknown}
                          className="h-9 w-full rounded border border-slate-300 bg-white px-2 font-mono text-xs text-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
                        />
                        {status.state === "error" && status.message && (
                          <div className="mt-1 text-xs text-red-700">
                            {status.message}
                          </div>
                        )}
                        {status.state === "saved" && (
                          <div className="mt-1 text-xs font-semibold text-emerald-700">
                            Saved
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <FieldPills values={row.indexes} tone="sky" />
                      </td>
                      <td className="px-4 py-3">
                        <FieldPills values={row.sourcetypes} expandable />
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-slate-700">
                        {formatNumber(row.events)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => saveOne(row)}
                          disabled={
                            isUnknown || isSaving || !row.draftDefinition.trim()
                          }
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
                })}
              </tbody>
            </table>
          </div>
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

        <details className="border border-slate-200 bg-white">
          <summary className="cursor-pointer border-b border-slate-200 px-4 py-3 text-base font-bold text-slate-900">
            Search SPL
          </summary>
          <pre className="m-0 max-h-[320px] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed text-slate-800">
            {searchSpl || "# Loading searchbase SPL..."}
          </pre>
        </details>
      </section>
    </main>
  );
}
