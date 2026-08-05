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
import { versionLabel } from "@splunk/splunk-utils/config";
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
const CATALYST_APP_NAME = "cisco-catalyst-app";
const DATA_CENTER_NETWORKING_APP_NAME = "cisco_dc_networking_app_for_splunk";
const MERAKI_APP_NAME = "Splunk_TA_cisco_meraki";
const INTERSIGHT_APP_NAME = "Splunk_TA_Cisco_Intersight";
const SPACES_APP_NAME = "ta_cisco_spaces";
const TUNING_SEARCHBASE_ID = "admin_macro_index_tuning";
const TUNING_SEARCH_NAME = "Admin - Macro Index Tuning";
const ADHOC_MACRO_NAME = "scd_summariesonly";
const DEFAULT_SUMMARIESONLY_DEFINITION =
  "summariesonly=false allow_old_summaries=false";
const ACCELERATED_SUMMARIESONLY_DEFINITION =
  "summariesonly=true allow_old_summaries=true";
const DEFAULT_SUMMARIESONLY_DESCRIPTION =
  "Controls whether data-model searches use only accelerated summaries or may fall back to raw events. Keep summariesonly=false until all required data models are fully accelerated.";
const SUMMARIESONLY_ACCELERATION_ERROR =
  "summariesonly=true requires acceleration for Cisco Catalyst, Cisco Security, and Cisco ThousandEyes.";
const SPLUNK_DOCS_VERSION = versionLabel.match(/^(\d+\.\d+)/)?.[1] || "10.4";
const DATA_MODEL_ACCELERATION_DOCS_URL = `https://help.splunk.com/en/splunk-enterprise/manage-knowledge-objects/knowledge-management-manual/${SPLUNK_DOCS_VERSION}/use-data-summaries-to-accelerate-searches/accelerate-data-models`;
const DATA_MODEL_ACCELERATION_SEARCH = `
| rest splunk_server=local timeout=600 /servicesNS/-/-/data/models
| rename eai:acl.* AS *, eai:data AS data
| rename field.* AS *
| rename acceleration.* AS *
| stats last(disabled) AS disabled last(acceleration) AS acceleration last(allow_old_summaries) AS allow_old_summaries last(earliest_time) AS earliest_time by app title
| search (app=Splunk_SA_CIM title IN (Authentication, Network_Traffic)) OR app IN (CiscoSecurityCloud, ta_cisco_thousandeyes, cisco-catalyst-app, cisco_dc_networking_app_for_splunk)
| sort 0 app title
| table app title acceleration allow_old_summaries earliest_time disabled
`;
const DEFAULT_INDEX_IN_DEFINITION = "index IN (*)";
const DEFAULT_INDEX_OR_DEFINITION = "(index=*)";
const DEFAULT_SOURCETYPE_IN_DEFINITION = "sourcetype IN (*)";
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
const cimHasTag = (tag: string): string =>
  `mvfind(cim_tags,"^${tag}$")>=0`;
const cimAll = (...predicates: string[]): string =>
  `(${predicates.join(" AND ")})`;
const cimAny = (...predicates: string[]): string =>
  `(${predicates.join(" OR ")})`;

const CIM_DATA_MODEL_DISCOVERY_CONFIGS = [
  {
    macro: "cim_Alerts_indexes",
    model: "Alerts",
    predicate: cimHasTag("alert"),
  },
  {
    macro: "cim_Application_State_indexes",
    model: "Application State",
    predicate: cimAny(
      cimAll(cimHasTag("listening"), cimHasTag("port")),
      cimAll(cimHasTag("process"), cimHasTag("report")),
      cimAll(cimHasTag("service"), cimHasTag("report")),
    ),
  },
  {
    macro: "cim_Authentication_indexes",
    model: "Authentication",
    predicate: cimAll(
      cimHasTag("authentication"),
      'NOT (action=="success" AND match(user,"\\$$"))',
    ),
  },
  {
    macro: "cim_Certificates_indexes",
    model: "Certificates",
    predicate: cimHasTag("certificate"),
  },
  {
    macro: "cim_Change_Analysis_indexes",
    model: "Change Analysis",
    predicate: cimHasTag("change"),
  },
  {
    macro: "cim_Change_indexes",
    model: "Change",
    predicate: cimHasTag("change"),
  },
  {
    macro: "cim_Compute_Inventory_indexes",
    model: "Compute Inventory",
    predicate: cimAll(
      cimHasTag("inventory"),
      cimAny(
        cimHasTag("cpu"),
        cimHasTag("memory"),
        cimHasTag("network"),
        cimHasTag("storage"),
        cimAll(cimHasTag("system"), cimHasTag("version")),
        cimHasTag("user"),
        cimHasTag("virtual"),
      ),
    ),
  },
  {
    macro: "cim_DLP_indexes",
    model: "Data Loss Prevention",
    predicate: cimAll(cimHasTag("dlp"), cimHasTag("incident")),
  },
  {
    macro: "cim_Databases_indexes",
    model: "Databases",
    predicate: cimHasTag("database"),
  },
  {
    macro: "cim_Data_Access_indexes",
    model: "Data Access",
    predicate: cimAll(cimHasTag("data"), cimHasTag("access")),
  },
  {
    macro: "cim_Email_indexes",
    model: "Email",
    predicate: cimHasTag("email"),
  },
  {
    macro: "cim_Endpoint_indexes",
    model: "Endpoint",
    predicate: cimAny(
      cimAll(cimHasTag("listening"), cimHasTag("port")),
      cimAll(cimHasTag("process"), cimHasTag("report")),
      cimAll(cimHasTag("service"), cimHasTag("report")),
      cimAll(cimHasTag("endpoint"), cimHasTag("filesystem")),
      cimAll(cimHasTag("endpoint"), cimHasTag("registry")),
    ),
  },
  {
    macro: "cim_Event_Signatures_indexes",
    model: "Event Signatures",
    predicate: cimAll(
      cimHasTag("track_event_signatures"),
      "(isnotnull(signature) OR isnotnull(signature_id))",
    ),
  },
  {
    macro: "cim_Interprocess_Messaging_indexes",
    model: "Interprocess Messaging",
    predicate: cimHasTag("messaging"),
  },
  {
    macro: "cim_Intrusion_Detection_indexes",
    model: "Intrusion Detection",
    predicate: cimAll(cimHasTag("ids"), cimHasTag("attack")),
  },
  {
    macro: "cim_JVM_indexes",
    model: "JVM",
    predicate: cimHasTag("jvm"),
  },
  {
    macro: "cim_Malware_indexes",
    model: "Malware",
    predicate: cimAll(cimHasTag("malware"), cimHasTag("attack")),
  },
  {
    macro: "cim_Network_Resolution_indexes",
    model: "Network Resolution",
    predicate: cimAll(
      cimHasTag("network"),
      cimHasTag("resolution"),
      cimHasTag("dns"),
    ),
  },
  {
    macro: "cim_Network_Sessions_indexes",
    model: "Network Sessions",
    predicate: cimAll(cimHasTag("network"), cimHasTag("session")),
  },
  {
    macro: "cim_Network_Traffic_indexes",
    model: "Network Traffic",
    predicate: cimAll(cimHasTag("network"), cimHasTag("communicate")),
  },
  {
    macro: "cim_Performance_indexes",
    model: "Performance",
    predicate: cimAll(
      cimHasTag("performance"),
      cimAny(
        cimHasTag("cpu"),
        cimHasTag("facilities"),
        cimHasTag("memory"),
        cimHasTag("storage"),
        cimHasTag("network"),
        cimAll(
          cimHasTag("os"),
          cimAny(
            cimAll(cimHasTag("time"), cimHasTag("synchronize")),
            cimHasTag("uptime"),
          ),
        ),
      ),
    ),
  },
  {
    macro: "cim_Ticket_Management_indexes",
    model: "Ticket Management",
    predicate: cimHasTag("ticketing"),
  },
  {
    macro: "cim_Updates_indexes",
    model: "Updates",
    predicate: cimAll(cimHasTag("update"), cimHasTag("status")),
  },
  {
    macro: "cim_Vulnerabilities_indexes",
    model: "Vulnerabilities",
    predicate: cimAll(cimHasTag("vulnerability"), cimHasTag("report")),
  },
  {
    macro: "cim_Web_indexes",
    model: "Web",
    predicate: cimHasTag("web"),
  },
] as const;
const CIM_MACRO_NAMES = CIM_DATA_MODEL_DISCOVERY_CONFIGS.map(
  ({ macro }) => macro,
);
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
const CATALYST_APP_MACRO_NAMES = [
  "cisco_catalyst_app_index",
  "cisco_catalyst_app_sourcetypes",
  "cisco_catalyst_sdwan_index",
] as const;
const DATA_CENTER_NETWORKING_INDEX_MACRO_NAMES = [
  "cisco_dc_aci_index",
  "cisco_dc_nd_index",
  "cisco_dc_n9k_index",
] as const;
const COMPANION_APP_INDEX_MACROS = [
  {
    macro: "meraki_index",
    targetApp: MERAKI_APP_NAME,
    family: "meraki",
  },
  {
    macro: "cisco_intersight_index",
    targetApp: INTERSIGHT_APP_NAME,
    family: "intersight",
  },
  {
    macro: "spaces_index",
    targetApp: SPACES_APP_NAME,
    family: "spaces",
  },
] as const;
const TARGET_APP_ORDER = [
  APP_NAME,
  CATALYST_APP_NAME,
  DATA_CENTER_NETWORKING_APP_NAME,
  MERAKI_APP_NAME,
  INTERSIGHT_APP_NAME,
  SPACES_APP_NAME,
  CISCO_SECURITY_APP_NAME,
  THOUSAND_EYES_APP_NAME,
  CIM_APP_NAME,
] as const;
const TARGET_APP_LABELS: Record<string, string> = {
  [APP_NAME]: "Splunk App for Secure Networking",
  [CATALYST_APP_NAME]: "Cisco Enterprise Networking for Splunk Platform",
  [DATA_CENTER_NETWORKING_APP_NAME]: "Cisco DC Networking App for Splunk",
  [MERAKI_APP_NAME]: "Cisco Meraki Add-on for Splunk",
  [INTERSIGHT_APP_NAME]: "Cisco Intersight Add-On for Splunk",
  [SPACES_APP_NAME]: "Cisco Spaces Add-on for Splunk",
  [CIM_APP_NAME]: "Splunk Common Information Model",
  [CISCO_SECURITY_APP_NAME]: "Cisco Security Cloud",
  [THOUSAND_EYES_APP_NAME]: "Cisco ThousandEyes App for Splunk",
};
const CISCO_SECURITY_DEFINITION_SUFFIXES: Record<string, string> = {
  nvm_sysdata_index: 'sourcetype="cisco:nvm:sysdata:v2"',
  nvm_process_index: 'sourcetype="cisco:nvm:processinfodata:v2"',
  nvm_flowdata_index: 'sourcetype="cisco:nvm:flowdata:v2"',
  nvm_combined_index:
    '(sourcetype="cisco:nvm:flowdata:v2" OR sourcetype="cisco:nvm:processinfodata:v2")',
};
const CIM_MACRO_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  CIM_DATA_MODEL_DISCOVERY_CONFIGS.map(({ macro, model }) => [
    macro,
    `Limits Splunk CIM ${model} data-model searches to indexes containing events matched by its CIM constraints.`,
  ]),
);
const EXTERNAL_MACRO_DESCRIPTIONS: Record<string, string> = {
  ...CIM_MACRO_DESCRIPTIONS,
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
  cisco_catalyst_app_index:
    "Routes Cisco Catalyst dashboard searches to indexes containing Catalyst Center, ISE, SD-WAN, CyberVision, Meraki, IOS, ThousandEyes, and related network events.",
  cisco_catalyst_app_sourcetypes:
    "Defines the broad app-owned sourcetype allow-list used by the Cisco Catalyst data model and index discovery. Keep it broad; use the index macros for deployment-specific scoping.",
  cisco_catalyst_sdwan_index:
    "Routes Cisco Catalyst SD-WAN dashboard searches to indexes containing Cisco SD-WAN events.",
  cisco_dc_aci_index:
    "Routes Cisco Data Center Networking ACI searches to indexes containing ACI events.",
  cisco_dc_nd_index:
    "Routes Cisco Data Center Networking Nexus Dashboard searches to indexes containing Nexus Dashboard and MSO events.",
  cisco_dc_n9k_index:
    "Routes Cisco Data Center Networking Nexus 9000 searches to indexes containing Nexus 9000 events.",
  meraki_index:
    "Routes Cisco Meraki Add-on searches to indexes containing Meraki dashboard, appliance, switch, wireless, and security events.",
  cisco_intersight_index:
    "Routes Cisco Intersight Add-On searches to indexes containing Cisco Intersight inventory, health, and operations events.",
  spaces_index:
    "Routes Cisco Spaces Add-on searches to indexes containing Cisco Spaces firehose events.",
};

type ScanState = "idle" | "loading" | "ready" | "error";
type SaveState = "idle" | "saving" | "saved" | "error";
type CopyState = "idle" | "copied" | "selected" | "error";
type DefinitionFormat = "indexIn" | "indexOr" | "sourcetypeIn";
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
  preserveCurrentDefinition?: boolean;
  family:
    | "scd"
    | "cim"
    | "catalyst"
    | "dataCenterNetworking"
    | "meraki"
    | "intersight"
    | "spaces"
    | "ciscoSecurity"
    | "thousandEyes";
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
const CATALYST_APP_MACRO_CONFIGS: TunableMacroConfig[] =
  CATALYST_APP_MACRO_NAMES.map((macro) => ({
    macro,
    targetApp: CATALYST_APP_NAME,
    definitionFormat:
      macro === "cisco_catalyst_app_sourcetypes"
        ? "sourcetypeIn"
        : "indexIn",
    preserveCurrentDefinition:
      macro === "cisco_catalyst_app_sourcetypes",
    family: "catalyst",
  }));
const DATA_CENTER_NETWORKING_INDEX_MACRO_CONFIGS: TunableMacroConfig[] =
  DATA_CENTER_NETWORKING_INDEX_MACRO_NAMES.map((macro) => ({
    macro,
    targetApp: DATA_CENTER_NETWORKING_APP_NAME,
    definitionFormat: "indexIn",
    family: "dataCenterNetworking",
  }));
const COMPANION_APP_INDEX_MACRO_CONFIGS: TunableMacroConfig[] =
  COMPANION_APP_INDEX_MACROS.map(({ macro, targetApp, family }) => ({
    macro,
    targetApp,
    definitionFormat: "indexIn",
    family,
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
    ...CATALYST_APP_MACRO_CONFIGS,
    ...DATA_CENTER_NETWORKING_INDEX_MACRO_CONFIGS,
    ...COMPANION_APP_INDEX_MACRO_CONFIGS,
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
  allowOldSummaries: boolean;
  message: string;
}

interface DataModelGroup {
  app: string;
  label: string;
  items: DataModelAcceleration[];
  enabledCount: number;
  attentionCount: number;
  checkingCount: number;
}

const CORE_DATA_MODEL_REQUIREMENTS: readonly DataModelRequirement[] = [
  {
    key: "catalyst",
    label: "Cisco Catalyst",
    app: CATALYST_APP_NAME,
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

const DATA_MODEL_APP_LABELS: Readonly<Record<string, string>> = {
  [CATALYST_APP_NAME]: "Cisco Catalyst",
  [CISCO_SECURITY_APP_NAME]: "Cisco Security Cloud",
  [THOUSAND_EYES_APP_NAME]: "Cisco ThousandEyes",
  [DATA_CENTER_NETWORKING_APP_NAME]: "Cisco Data Center Networking",
  [CIM_APP_NAME]: "Splunk Common Information Model",
};

const DATA_MODEL_APP_ORDER = [
  CATALYST_APP_NAME,
  CISCO_SECURITY_APP_NAME,
  THOUSAND_EYES_APP_NAME,
  DATA_CENTER_NETWORKING_APP_NAME,
  CIM_APP_NAME,
] as const;

const REQUIRED_DATA_MODEL_KEYS = new Set(
  CORE_DATA_MODEL_REQUIREMENTS.filter(
    (requirement) => requirement.priority === "required",
  ).map((requirement) => `${requirement.app}:${requirement.model}`),
);

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

const CIM_DISCOVERY_BASE_TAGS = [
  "alert",
  "listening",
  "process",
  "service",
  "authentication",
  "certificate",
  "change",
  "inventory",
  "dlp",
  "database",
  "data",
  "email",
  "endpoint",
  "track_event_signatures",
  "messaging",
  "ids",
  "jvm",
  "malware",
  "network",
  "performance",
  "ticketing",
  "update",
  "vulnerability",
  "web",
] as const;
const CIM_DISCOVERY_SEARCH = [
  `search index=* (${CIM_DISCOVERY_BASE_TAGS.map((tag) => `tag=${tag}`).join(" OR ")})`,
  "| tags outputfield=cim_tags",
  `| eval macro=mvappend(${CIM_DATA_MODEL_DISCOVERY_CONFIGS.map(
    ({ macro, predicate }) =>
      `if(${predicate},"${macro}",null())`,
  ).join(",")})`,
  "| where isnotnull(macro)",
  "| mvexpand macro",
  '| eval sourcetype=coalesce(sourcetype, "(unknown sourcetype)")',
  "| stats values(index) as indexes, values(sourcetype) as sourcetypes, dc(sourcetype) as sourcetype_count, count as events by macro",
  `| eval target_app="${CIM_APP_NAME}", definition_format="indexOr"`,
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
  if (normalized === "indexOr") return "indexOr";
  if (normalized === "sourcetypeIn") return "sourcetypeIn";
  return "indexIn";
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

const splunkDataModelManagerUrl = ({
  app,
  model,
}: Pick<DataModelRequirement, "app" | "model">): string =>
  `${splunkAppManagerUrl(app, "data_model_manager")}?${new URLSearchParams({
    appSearch: app,
    visible: "0",
    nameFilter: model,
  }).toString()}`;

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

const extractSourcetypeTokens = (definition: string): string[] => {
  const inMatch = definition.match(/\bsourcetype\s+IN\s*\(([^)]*)\)/i);
  if (!inMatch) return [];
  return inMatch[1]
    .split(",")
    .map(cleanIndexToken)
    .filter(Boolean);
};

const formatMacroDefinition = (
  values: string[],
  definitionFormat: DefinitionFormat,
  definitionSuffix = "",
): string => {
  const tokens = values.map(cleanIndexToken).filter(Boolean);
  const suffix = definitionSuffix.trim() ? ` ${definitionSuffix.trim()}` : "";
  if (definitionFormat === "sourcetypeIn") {
    const definition = tokens.length
      ? `sourcetype IN (${tokens.map((token) => `"${token}"`).join(", ")})`
      : DEFAULT_SOURCETYPE_IN_DEFINITION;
    return `${definition}${suffix}`;
  }
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
      formatMacroDefinition(
        [],
        config.definitionFormat,
        config.definitionSuffix,
      );
    const draftDefinition =
      config.preserveCurrentDefinition && details?.definition
        ? details.definition
        : scanned?.definition || fallbackDefinition;

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
      sourcetypes: scanned?.sourcetypes?.length
        ? scanned.sourcetypes
        : config.definitionFormat === "sourcetypeIn"
          ? extractSourcetypeTokens(fallbackDefinition)
          : [],
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

interface SplunkAppInventoryEntry {
  name?: unknown;
  content?: { disabled?: unknown };
}

const installedAppsUrl = (): string =>
  `/${getSplunkLocale()}/splunkd/__raw/services/apps/local?count=0&output_mode=json`;

const loadInstalledAppIds = async (): Promise<Set<string>> => {
  const response = await fetch(installedAppsUrl(), {
    ...getDefaultFetchInit(),
    method: "GET",
  });
  let payload: { entry?: SplunkAppInventoryEntry[] } | null = null;
  try {
    payload = (await response.json()) as { entry?: SplunkAppInventoryEntry[] };
  } catch {
    payload = null;
  }
  if (!response.ok) {
    throw new Error(`Could not list installed apps (HTTP ${response.status}).`);
  }

  const appIds = new Set<string>([APP_NAME]);
  (payload?.entry || []).forEach((entry) => {
    const appId = normalizeText(entry.name).trim();
    if (appId && !isTrueConfigValue(entry.content?.disabled)) {
      appIds.add(appId);
    }
  });
  return appIds;
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

const dataModelRequirementId = ({
  app,
  model,
}: Pick<DataModelRequirement, "app" | "model">): string => `${app}:${model}`;

const CORE_DATA_MODEL_REQUIREMENTS_BY_ID = new Map(
  CORE_DATA_MODEL_REQUIREMENTS.map((requirement) => [
    dataModelRequirementId(requirement),
    requirement,
  ]),
);

const dataModelLabel = (app: string, model: string): string =>
  CORE_DATA_MODEL_REQUIREMENTS_BY_ID.get(`${app}:${model}`)?.label ||
  model.replace(/_/g, " ").replace(/\bnexus\b/gi, "Nexus");

const parseDataModelAcceleration = (
  row: Record<string, unknown>,
): DataModelAcceleration | null => {
  const app = normalizeText(row.app).trim();
  const model = normalizeText(row.title).trim();
  if (!app || !model) return null;

  const id = `${app}:${model}`;
  const disabled = isTrueConfigValue(row.disabled);
  const enabled = isTrueConfigValue(row.acceleration) && !disabled;
  return {
    key: id,
    label: dataModelLabel(app, model),
    app,
    model,
    priority: REQUIRED_DATA_MODEL_KEYS.has(id) ? "required" : "recommended",
    state: enabled ? "enabled" : "disabled",
    earliestTime: normalizeText(row.earliest_time).trim(),
    allowOldSummaries: isTrueConfigValue(row.allow_old_summaries),
    message: disabled
      ? "Data model is disabled"
      : enabled
        ? "Acceleration enabled"
        : "Acceleration is not enabled",
  };
};

const buildDataModelAccelerationInventory = (
  rows: Record<string, unknown>[],
): DataModelAcceleration[] => {
  const inventoryById = new Map<string, DataModelAcceleration>();
  rows.forEach((row) => {
    const item = parseDataModelAcceleration(row);
    if (item) inventoryById.set(dataModelRequirementId(item), item);
  });

  CORE_DATA_MODEL_REQUIREMENTS.forEach((requirement) => {
    const id = dataModelRequirementId(requirement);
    if (inventoryById.has(id)) return;
    inventoryById.set(id, {
      ...requirement,
      state: "missing",
      earliestTime: "",
      allowOldSummaries: false,
      message: "Data model was not found",
    });
  });

  const appRank = new Map<string, number>(
    DATA_MODEL_APP_ORDER.map((app, index) => [app, index]),
  );
  return Array.from(inventoryById.values()).sort((left, right) => {
    const appDifference =
      (appRank.get(left.app) ?? DATA_MODEL_APP_ORDER.length) -
      (appRank.get(right.app) ?? DATA_MODEL_APP_ORDER.length);
    return appDifference || left.model.localeCompare(right.model);
  });
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
  >(() => Object.fromEntries(TARGET_APP_ORDER.map((app) => [app, true])));
  const [installedAppIds, setInstalledAppIds] = useState<Set<string>>(
    () => new Set([APP_NAME]),
  );
  const [appInventoryError, setAppInventoryError] = useState("");
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
    CORE_DATA_MODEL_REQUIREMENTS.map((requirement) => ({
      ...requirement,
      state: "checking",
      earliestTime: "",
      allowOldSummaries: false,
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

  const installedTargetApps = useMemo(
    () =>
      TARGET_APP_ORDER.filter((targetApp) => installedAppIds.has(targetApp)),
    [installedAppIds],
  );
  const isTargetAppInstalled = useCallback(
    (targetApp: string): boolean => installedAppIds.has(targetApp),
    [installedAppIds],
  );

  useEffect(() => {
    let disposed = false;
    void loadInstalledAppIds()
      .then((appIds) => {
        if (disposed) return;
        setInstalledAppIds(appIds);
        setAppInventoryError("");
      })
      .catch(() => {
        if (disposed) return;
        setInstalledAppIds(new Set([APP_NAME]));
        setAppInventoryError(
          "Companion apps could not be verified, so their macro definitions are hidden.",
        );
      });
    return () => {
      disposed = true;
    };
  }, []);

  const generatedMacroStanzasByApp = useMemo<Record<string, string>>(
    () =>
      Object.fromEntries(
        installedTargetApps.map((targetApp) => [
          targetApp,
          buildMacroStanzas(allRows, targetApp, tunableMacroNameSet),
        ]),
      ),
    [allRows, installedTargetApps, tunableMacroNameSet],
  );
  const macroStanzas = useMemo(() => {
    const sections = installedTargetApps.flatMap((targetApp) => {
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
  }, [
    adhocDefinition,
    adhocDescription,
    generatedMacroStanzasByApp,
    installedTargetApps,
  ]);
  const hasUnknown = rows.some((row) => row.macro === "unknown");
  const fastTunableRows = rows.filter(
    (row) =>
      fastTuningMacroNameSet.has(row.macro) &&
      isTargetAppInstalled(row.targetApp),
  );
  const cimMacroRows = cimRows.filter(
    (row) =>
      CIM_MACRO_NAME_SET.has(row.macro) &&
      isTargetAppInstalled(row.targetApp),
  );
  const tunableRows = [...fastTunableRows, ...cimMacroRows];
  const indexMacroRows = tunableRows.filter((row) =>
    indexMacroNameSet.has(row.macro),
  );
  const modelMacroRows = tunableRows.filter(
    (row) =>
      row.targetApp !== APP_NAME &&
      row.targetApp !== CIM_APP_NAME &&
      isTargetAppInstalled(row.targetApp),
  );
  const rowsToSave = tunableRows.filter(
    (row) => isTargetAppInstalled(row.targetApp) && row.draftDefinition.trim(),
  );
  const setupScdRowsToSave = rows.filter(
    (row) =>
      row.targetApp === APP_NAME &&
      row.macro.startsWith("index_") &&
      row.events > 0 &&
      row.draftDefinition.trim(),
  );
  const setupExternalRowsToSave = rows.filter(
    (row) =>
      row.targetApp !== APP_NAME &&
      row.targetApp !== CIM_APP_NAME &&
      isTargetAppInstalled(row.targetApp) &&
      row.events > 0 &&
      row.draftDefinition.trim(),
  );
  const setupRowsToSave = [...setupScdRowsToSave, ...setupExternalRowsToSave];
  const summariesOnlyEnabled = usesSummariesOnly(adhocDefinition);
  const requiredDataModels = dataModelReadiness.filter(
    (item) => item.priority === "required",
  );
  const allRequiredDataModelsAccelerated =
    requiredDataModels.length ===
      CORE_DATA_MODEL_REQUIREMENTS.filter(
        (requirement) => requirement.priority === "required",
      ).length && requiredDataModels.every((item) => item.state === "enabled");
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
  const dashboardMacroRows = rows.filter((row) => row.targetApp === APP_NAME);
  const externalAppMacroRows = rows.filter(
    (row) =>
      row.targetApp !== APP_NAME &&
      row.targetApp !== CIM_APP_NAME &&
      isTargetAppInstalled(row.targetApp),
  );
  const filteredDashboardMacroRows = filteredRows.filter(
    (row) => row.targetApp === APP_NAME,
  );
  const filteredExternalAppMacroRows = filteredRows.filter(
    (row) =>
      row.targetApp !== APP_NAME &&
      row.targetApp !== CIM_APP_NAME &&
      isTargetAppInstalled(row.targetApp),
  );
  const filteredCimRows = useMemo(
    () =>
      cimRows.filter(
        (row) =>
          isTargetAppInstalled(row.targetApp) &&
          rowMatchesFilter(row, filterTerms),
      ),
    [cimRows, filterTerms, isTargetAppInstalled],
  );
  const filteredDashboardMacroGroups = useMemo(
    () => groupRowsByTargetApp(filteredDashboardMacroRows),
    [filteredDashboardMacroRows],
  );
  const filteredExternalAppMacroGroups = useMemo(
    () => groupRowsByTargetApp(filteredExternalAppMacroRows),
    [filteredExternalAppMacroRows],
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
  const externalAppMacroSummaries = installedTargetApps.filter(
    (targetApp) => targetApp !== APP_NAME && targetApp !== CIM_APP_NAME,
  ).map((targetApp) => {
    const appRows = modelMacroRows.filter((row) => row.targetApp === targetApp);
    return {
      targetApp,
      label: getTargetAppLabel(targetApp),
      rows: appRows,
      matchedMacroCount: appRows.filter((row) => row.events > 0).length,
      indexCount: appRows.reduce(
        (sum, row) => sum + extractIndexTokens(row.draftDefinition).length,
        0,
      ),
      eventCount: appRows.reduce((sum, row) => sum + row.events, 0),
    };
  });
  const isLoading = scanState === "loading";
  const isCimLoading = cimScanState === "loading";
  const isSavingAll = Object.values(saveStatuses).some(
    (status) => status.state === "saving",
  );
  const setupIndexValueCount = setupRowsToSave.reduce(
    (sum, row) => sum + extractIndexTokens(row.draftDefinition).length,
    0,
  );
  const unknownSourcetypeGroups = rows.filter(
    (row) => row.macro === "unknown",
  ).length;
  const acceleratedRequiredModels = requiredDataModels.filter(
    (item) => item.state === "enabled",
  ).length;
  const acceleratedDataModelCount = dataModelReadiness.filter(
    (item) => item.state === "enabled",
  ).length;
  const dataModelsNeedingAttention = dataModelReadiness.filter(
    (item) =>
      item.state === "disabled" ||
      item.state === "missing" ||
      item.state === "error",
  );
  const dataModelGroups = useMemo<DataModelGroup[]>(() => {
    const groupsByApp = new Map<string, DataModelAcceleration[]>();
    dataModelReadiness.forEach((item) => {
      const appItems = groupsByApp.get(item.app) || [];
      appItems.push(item);
      groupsByApp.set(item.app, appItems);
    });

    return DATA_MODEL_APP_ORDER.flatMap((app) => {
      const items = groupsByApp.get(app);
      if (!items?.length) return [];
      return [
        {
          app,
          label: DATA_MODEL_APP_LABELS[app] || app,
          items,
          enabledCount: items.filter((item) => item.state === "enabled").length,
          attentionCount: items.filter(
            (item) =>
              item.state === "disabled" ||
              item.state === "missing" ||
              item.state === "error",
          ).length,
          checkingCount: items.filter((item) => item.state === "checking")
            .length,
        },
      ];
    });
  }, [dataModelReadiness]);
  const selectSetupPerformanceMode = (acceleratedOnly: boolean) => {
    setAdhocDefinition(
      acceleratedOnly
        ? ACCELERATED_SUMMARIESONLY_DEFINITION
        : DEFAULT_SUMMARIESONLY_DEFINITION,
    );
    setAdhocStatus({ state: "idle" });
  };
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
  const openAccelerationSearchUrl = splunkSearchAppUrl(
    DATA_MODEL_ACCELERATION_SEARCH,
    { earliest: "0", latest: "now" },
  );
  const macrosManagerUrl = splunkManagerUrl("data/macros");
  const externalAppMacroManagerLinks = installedTargetApps.filter(
    (targetApp) => targetApp !== APP_NAME && targetApp !== CIM_APP_NAME,
  ).map((targetApp) => ({
    targetApp,
    href: splunkAppManagerUrl(targetApp, "data/macros"),
  }));
  const cimMacrosManagerUrl = splunkAppManagerUrl(CIM_APP_NAME, "data/macros");

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
      const availableMacroConfigs = catalog.fastTuningMacroConfigs.filter(
        (config) => isTargetAppInstalled(config.targetApp),
      );
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
        availableMacroConfigs,
      );
      const parsed = ((result.results || []) as Record<string, unknown>[])
        .map((row) => parseSearchResult(row, catalog.macroConfigByName))
        .filter((row): row is MacroRow => Boolean(row));
      const expectedRows = buildExpectedEditableRows(
        availableMacroConfigs,
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
  }, [
    isTargetAppInstalled,
    loadTuningSearch,
    timeRange.earliest,
    timeRange.latest,
  ]);

  useEffect(() => {
    void runScan();
    return () => {
      abortRef.current?.abort();
    };
  }, [runScan]);

  const loadCimMacroRows = useCallback(async () => {
    if (!isTargetAppInstalled(CIM_APP_NAME)) {
      setCimRows([]);
      setCimScanState("idle");
      return;
    }
    const currentDetails = await loadMacroDetailsByConfig(CIM_MACRO_CONFIGS);
    setCimRows(
      buildExpectedEditableRows(CIM_MACRO_CONFIGS, [], currentDetails),
    );
  }, [isTargetAppInstalled]);

  const runCimDiscovery = useCallback(async () => {
    if (!isTargetAppInstalled(CIM_APP_NAME)) return;
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
  }, [
    cimTimeRange.earliest,
    cimTimeRange.latest,
    isTargetAppInstalled,
    macroConfigByName,
  ]);

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
      CORE_DATA_MODEL_REQUIREMENTS.map((requirement) => ({
        ...requirement,
        state: "checking",
        earliestTime: "",
        allowOldSummaries: false,
        message: "Checking acceleration",
      })),
    );

    try {
      const result = await runSearch({
        spl: DATA_MODEL_ACCELERATION_SEARCH,
        earliestTime: "0",
        latestTime: "now",
        count: 0,
        tag: "data-model-acceleration-readiness",
      });
      setDataModelReadiness(
        buildDataModelAccelerationInventory(
          (result.results || []) as Record<string, unknown>[],
        ),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setDataModelReadiness(
        CORE_DATA_MODEL_REQUIREMENTS.map((requirement) => ({
          ...requirement,
          state: "error" as const,
          earliestTime: "",
          allowOldSummaries: false,
          message,
        })),
      );
    }
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
    if (summariesOnlyBlocked) {
      setSetupStatus({
        state: "error",
        message: SUMMARIESONLY_ACCELERATION_ERROR,
      });
      return;
    }
    setSetupStatus({
      state: "saving",
      message: "Saving detected routing macros",
    });

    try {
      setSetupStatus({
        state: "saving",
        message: "Saving acceleration mode",
      });
      try {
        await saveMacroDefinition(
          ADHOC_MACRO_NAME,
          adhocDefinition.trim(),
          adhocDescription,
          APP_NAME,
        );
        setAdhocStatus({ state: "saved", message: "Saved" });
      } catch (saveError) {
        setAdhocStatus({
          state: "error",
          message:
            saveError instanceof Error ? saveError.message : String(saveError),
        });
      }

      setSetupStatus({
        state: "saving",
        message:
          scanState === "ready"
            ? "Saving detected routing macros"
            : "Skipping routing macro tuning",
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
            row.targetApp,
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
          // Macro tuning is optional during setup. A failed write must not
          // prevent the user from unlocking the dashboard and retrying later.
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
          setupError instanceof Error ? setupError.message : String(setupError),
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
                <span className="flex min-w-0 items-center gap-2 normal-case tracking-normal">
                  <span className="truncate text-sm font-semibold text-slate-700">
                    {getTargetAppLabel(targetApp)}
                  </span>
                  <code className="shrink-0 font-mono text-[11px] font-medium text-slate-500">
                    {targetApp}/local/macros.conf
                  </code>
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

  if (setupMode) {
    const setupScdRowGroups = groupRowsByTargetApp(setupScdRowsToSave);
    const setupExternalRowGroups = groupRowsByTargetApp(
      setupExternalRowsToSave,
    );
    const setupScanReady = scanState === "ready";
    const setupMacroCountLabel =
      setupRowsToSave.length === 1 ? "routing macro is" : "routing macros are";
    const setupMacroNoun =
      setupRowsToSave.length === 1 ? "routing macro" : "routing macros";
    const setupMetrics = [
      {
        value: setupRowsToSave.length,
        label: "Macros",
        colorClass: "text-sky-700",
      },
      {
        value: setupIndexValueCount,
        label: "Indexes",
        colorClass: "text-emerald-700",
      },
      {
        value: unknownSourcetypeGroups,
        label: "Unmapped",
        colorClass:
          unknownSourcetypeGroups > 0 ? "text-amber-700" : "text-emerald-700",
      },
    ];
    let scanEyebrow = "Automatic scan complete";
    let scanHeading = `${setupRowsToSave.length} ${setupMacroCountLabel} ready to save`;
    if (isLoading) {
      scanEyebrow = "Automatic scan in progress";
      scanHeading = "Finding Cisco routing macros…";
    } else if (error) {
      scanEyebrow = "Automatic scan needs attention";
      scanHeading = "The index scan could not complete";
    }
    let performanceStatusClass = "bg-slate-100 text-slate-600";
    let performanceStatusMessage =
      "Balanced mode is ready with no extra action.";
    if (summariesOnlyEnabled && accelerationCheckInProgress) {
      performanceStatusClass = "bg-sky-50 text-sky-800";
      performanceStatusMessage = "Checking required data-model acceleration…";
    } else if (summariesOnlyBlocked) {
      performanceStatusClass = "bg-red-50 text-red-800";
      performanceStatusMessage = `${acceleratedRequiredModels} of ${requiredDataModels.length} required data models are accelerated.`;
    } else if (summariesOnlyEnabled) {
      performanceStatusClass = "bg-emerald-50 text-emerald-800";
      performanceStatusMessage =
        "All required Cisco data models are accelerated.";
    }
    let setupActionMessage = `${setupRowsToSave.length} detected ${setupMacroNoun} and the selected performance mode will be saved.`;
    if (summariesOnlyBlocked) {
      setupActionMessage =
        "Choose Balanced or accelerate all three required Cisco data models.";
    } else if (scanState === "loading") {
      setupActionMessage = "Waiting for the automatic index scan to finish.";
    } else if (scanState === "error") {
      setupActionMessage =
        "The index scan did not complete. Finish setup now and retry macro tuning later.";
    }

    return (
      <main className="min-h-screen bg-[#f4f8fa] pb-28 text-slate-800">
        <section className="bg-[#102a43] text-white">
          <div className="mx-auto grid max-w-[1180px] gap-6 px-7 py-5 md:grid-cols-[minmax(0,1fr)_400px] md:items-center">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-cyan-300">
                Splunk App for Secure Networking · Setup · Step 3 of 3
              </div>
              <h1 className="mt-1 text-2xl font-bold leading-tight text-white">
                Finish setup with the detected routing macros
              </h1>
              <p className="mt-1.5 max-w-3xl text-sm text-slate-300">
                Review exceptions, choose a search-performance mode, then save
                and unlock the dashboards.
              </p>
            </div>
            <ol className="grid grid-cols-3 overflow-hidden rounded-md bg-white/10 text-[11px] font-bold">
              <li className="flex min-h-10 items-center gap-2 bg-emerald-900 px-3 text-emerald-50">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-600 text-[10px]">
                  <Check size={12} />
                </span>
                Check data
              </li>
              <li className="flex min-h-10 items-center gap-2 bg-emerald-900 px-3 text-emerald-50">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-600 text-[10px]">
                  <Check size={12} />
                </span>
                Packages
              </li>
              <li className="flex min-h-10 items-center gap-2 bg-sky-800 px-3 text-white">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-cyan-500 text-[10px]">
                  3
                </span>
                Tune indexes
              </li>
            </ol>
          </div>
        </section>

        <div className="mx-auto max-w-[1180px] px-6 py-5">
          <section
            aria-live="polite"
            className={`mb-4 grid gap-4 rounded-lg border px-5 py-3.5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center ${
              error
                ? "border-red-200 bg-red-50"
                : "border-emerald-200 bg-emerald-50"
            }`}
          >
            <div>
              <div
                className={`text-[10px] font-bold uppercase tracking-wide ${
                  error ? "text-red-700" : "text-emerald-700"
                }`}
              >
                {scanEyebrow}
              </div>
              <h2 className="mt-0.5 text-lg font-bold text-slate-900">
                {scanHeading}
              </h2>
              <p className="mt-0.5 text-xs text-slate-600">
                {error ||
                  "Only review definitions when an index looks unexpected."}
              </p>
              <a
                href="#setup-data-model-readiness"
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-sky-800 hover:text-sky-950"
              >
                {accelerationCheckInProgress
                  ? "Checking recommended data-model acceleration…"
                  : `${acceleratedDataModelCount} of ${dataModelReadiness.length} recommended data models accelerated`}
                <ChevronRight size={13} />
              </a>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {setupMetrics.map(({ value, label, colorClass }) => (
                <div
                  key={label}
                  className="min-w-[72px] rounded-md bg-white px-3 py-2 text-center"
                >
                  <div className={`text-lg font-bold ${colorClass}`}>
                    {formatNumber(value)}
                  </div>
                  <div className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_330px]">
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="text-[10px] font-bold uppercase tracking-wide text-sky-700">
                Index macro plan
              </div>
              <h2 className="mt-1 text-lg font-bold text-slate-900">
                Review only what needs attention
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                Detected definitions are saved together when setup finishes.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <div className="flex min-h-9 items-center gap-2 rounded-md bg-slate-100 px-3 text-xs text-slate-600">
                  <span className="font-semibold">Range</span>
                  <TimeRangeDropdown
                    earliest={timeRange.earliest}
                    latest={timeRange.latest}
                    onChange={handleFastTimeRangeChange}
                    realTimeDisabled
                    presets={TIME_PRESETS}
                    onRequestParseEarliest={
                      fastTimeParser.handleRequestParseEarliest
                    }
                    onRequestParseLatest={
                      fastTimeParser.handleRequestParseLatest
                    }
                    parseEarliest={fastTimeParser.parseEarliest}
                    parseLatest={fastTimeParser.parseLatest}
                    labelMaxChars={26}
                  />
                </div>
                <button
                  type="button"
                  onClick={runScan}
                  disabled={isLoading}
                  className={`${compactButtonBase} border-slate-300 bg-white text-slate-700 hover:border-sky-400 hover:text-sky-700`}
                >
                  {isLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                  {isLoading ? "Scanning" : "Run scan again"}
                </button>
              </div>

              {setupScanReady && (
                <div
                  className={`mt-4 flex items-start gap-3 rounded-md border px-3 py-3 ${
                    hasUnknown
                      ? "border-amber-200 bg-amber-50"
                      : "border-emerald-200 bg-emerald-50"
                  }`}
                >
                  {hasUnknown ? (
                    <AlertTriangle
                      className="mt-0.5 shrink-0 text-amber-700"
                      size={18}
                    />
                  ) : (
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-600 text-white">
                      <Check size={14} />
                    </span>
                  )}
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      {hasUnknown
                        ? `${unknownSourcetypeGroups} unmapped sourcetype group${
                            unknownSourcetypeGroups === 1 ? "" : "s"
                          } need review`
                        : "No unmapped sourcetypes found"}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-600">
                      {hasUnknown
                        ? "Open the definitions below and map unexpected data before finishing."
                        : "All detected Cisco data maps to a known routing macro."}
                    </div>
                  </div>
                </div>
              )}

              <details className="group mt-4 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-bold text-slate-800 hover:bg-slate-100 [&::-webkit-details-marker]:hidden">
                  <span>
                    Review {setupScdRowsToSave.length} dashboard macro
                    {setupScdRowsToSave.length === 1 ? "" : "s"}
                  </span>
                  <ChevronDown
                    size={16}
                    className="ml-auto transition-transform group-open:rotate-180"
                  />
                </summary>
                <div className="border-t border-slate-200 bg-white">
                  {setupScdRowsToSave.length ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                            <th className="w-[190px] px-4 py-3 font-bold">
                              Macro
                            </th>
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
                        <tbody>{renderTableRows(setupScdRowGroups)}</tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="px-4 py-8 text-center text-sm text-slate-500">
                      No detected index macro definitions are ready yet.
                    </div>
                  )}
                </div>
              </details>

              <section
                aria-labelledby="setup-external-app-macros-heading"
                className="mt-5 overflow-hidden rounded-lg border border-sky-200 bg-sky-50/50"
              >
                <div className="px-4 py-4">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-sky-700">
                    Installed Cisco apps
                  </div>
                  <h3
                    id="setup-external-app-macros-heading"
                    className="mt-1 text-base font-bold text-slate-900"
                  >
                    Tune app-owned routing macros
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Save detected indexes directly to each app&apos;s
                    local/macros.conf so its dashboards are ready when you open
                    them.
                  </p>
                </div>

                <details className="group border-t border-sky-200 bg-white">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-bold text-slate-800 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                    <span>
                      Review {setupExternalRowsToSave.length} app macro
                      {setupExternalRowsToSave.length === 1 ? "" : "s"}
                    </span>
                    <ChevronDown
                      size={16}
                      className="ml-auto transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <div className="border-t border-slate-200">
                    {setupExternalRowsToSave.length ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                              <th className="w-[190px] px-4 py-3 font-bold">
                                Macro
                              </th>
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
                          <tbody>
                            {renderTableRows(setupExternalRowGroups)}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="px-4 py-6 text-center text-sm text-slate-500">
                        No installed Cisco app macros have matching data in this
                        range yet.
                      </div>
                    )}
                  </div>
                </details>
              </section>

              <p className="mt-3 text-xs text-slate-500">
                All CIM data-model macros remain optional and can be tuned
                after setup.
              </p>
            </section>

            <aside className="grid gap-4">
              <section
                id="setup-data-model-readiness"
                className="scroll-mt-4 rounded-lg border border-slate-200 bg-white p-5"
              >
                <div className="text-[10px] font-bold uppercase tracking-wide text-sky-700">
                  Search performance
                </div>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  Choose how searches run
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  You can change this later from Macro Index Tuning.
                </p>

                <div className="mt-4 grid gap-3">
                  <label
                    htmlFor="setup-performance-balanced"
                    className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3 hover:border-sky-300"
                  >
                    <input
                      id="setup-performance-balanced"
                      type="radio"
                      name="setup-search-performance"
                      checked={!summariesOnlyEnabled}
                      onChange={() => selectSetupPerformanceMode(false)}
                      className="mt-0.5 h-4 w-4 accent-sky-700"
                    />
                    <span>
                      <span className="block text-sm font-bold text-slate-900">
                        Balanced (recommended)
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                        Use acceleration when available and fall back to raw
                        events.
                      </span>
                    </span>
                  </label>
                  <label
                    htmlFor="setup-performance-accelerated"
                    className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3 hover:border-sky-300"
                  >
                    <input
                      id="setup-performance-accelerated"
                      type="radio"
                      name="setup-search-performance"
                      checked={summariesOnlyEnabled}
                      onChange={() => selectSetupPerformanceMode(true)}
                      className="mt-0.5 h-4 w-4 accent-sky-700"
                    />
                    <span>
                      <span className="block text-sm font-bold text-slate-900">
                        Accelerated summaries only
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                        Fastest, but requires all three Cisco data models to be
                        accelerated.
                      </span>
                    </span>
                  </label>
                </div>

                <div
                  className={`mt-3 rounded-md px-3 py-2 text-xs ${performanceStatusClass}`}
                >
                  {performanceStatusMessage}
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-sky-700">
                      Performance readiness
                    </div>
                    <h2 className="mt-1 text-lg font-bold text-slate-900">
                      Accelerate recommended data models
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={checkDataModelAcceleration}
                    disabled={accelerationCheckInProgress}
                    aria-label="Check data model acceleration again"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-slate-300 bg-white text-slate-600 hover:border-sky-400 hover:text-sky-700 disabled:cursor-wait disabled:opacity-60"
                  >
                    <RefreshCw
                      size={14}
                      className={
                        accelerationCheckInProgress ? "animate-spin" : ""
                      }
                    />
                  </button>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Acceleration makes the app&apos;s data-model searches return
                  faster. Setup can finish in Balanced mode while you complete
                  these recommendations.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a
                    href={openAccelerationSearchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open acceleration check in Search"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-bold text-sky-700 hover:border-sky-400 hover:text-sky-900"
                  >
                    <ExternalLink size={12} />
                    Open in Search
                  </a>
                  <a
                    href={DATA_MODEL_ACCELERATION_DOCS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open Splunk ${SPLUNK_DOCS_VERSION} data model acceleration documentation`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-bold text-sky-700 hover:border-sky-400 hover:text-sky-900"
                  >
                    <ExternalLink size={12} />
                    Splunk acceleration guide
                  </a>
                </div>

                <div
                  className={`mt-3 rounded-md px-3 py-2 text-xs font-semibold ${
                    accelerationCheckInProgress
                      ? "bg-sky-50 text-sky-800"
                      : dataModelsNeedingAttention.length
                        ? "bg-amber-50 text-amber-900"
                        : "bg-emerald-50 text-emerald-800"
                  }`}
                  role="status"
                >
                  {accelerationCheckInProgress
                    ? "Checking recommended data models…"
                    : dataModelsNeedingAttention.length
                      ? `${acceleratedDataModelCount} of ${dataModelReadiness.length} accelerated · ${dataModelsNeedingAttention.length} need attention`
                      : `All ${dataModelReadiness.length} recommended data models are accelerated.`}
                </div>

                <div
                  className="mt-3 grid gap-2"
                  aria-label="Recommended data model acceleration status"
                >
                  {dataModelGroups.map((group) => (
                    <details
                      key={`${group.app}:${group.enabledCount}:${group.attentionCount}:${group.checkingCount}`}
                      open={group.attentionCount > 0}
                      className="group overflow-hidden rounded-md border border-slate-200"
                    >
                      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs [&::-webkit-details-marker]:hidden">
                        {group.checkingCount ? (
                          <Loader2
                            size={14}
                            className="shrink-0 animate-spin text-sky-700"
                          />
                        ) : group.attentionCount ? (
                          <AlertTriangle
                            size={14}
                            className="shrink-0 text-amber-700"
                          />
                        ) : (
                          <Check
                            size={14}
                            className="shrink-0 text-emerald-700"
                          />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold text-slate-900">
                            {group.label}
                          </span>
                          <span className="block text-[11px] text-slate-500">
                            {group.checkingCount
                              ? "Checking acceleration"
                              : `${group.enabledCount} of ${group.items.length} accelerated`}
                          </span>
                        </span>
                        <ChevronDown
                          size={14}
                          className="shrink-0 text-slate-500 transition-transform group-open:rotate-180"
                        />
                      </summary>
                      <div className="divide-y divide-slate-100 border-t border-slate-200 bg-slate-50">
                        {group.items.map((item) => {
                          const enabled = item.state === "enabled";
                          const checking = item.state === "checking";
                          return (
                            <div
                              key={item.key}
                              className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 px-3 py-2.5 text-xs"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  {checking ? (
                                    <Loader2
                                      size={12}
                                      className="shrink-0 animate-spin text-sky-700"
                                    />
                                  ) : enabled ? (
                                    <Check
                                      size={12}
                                      className="shrink-0 text-emerald-700"
                                    />
                                  ) : (
                                    <AlertTriangle
                                      size={12}
                                      className="shrink-0 text-amber-700"
                                    />
                                  )}
                                  <span className="truncate font-bold text-slate-800">
                                    {item.label}
                                  </span>
                                </div>
                                <code className="mt-0.5 block truncate font-mono text-[10px] text-slate-500">
                                  {item.model}
                                </code>
                                <div
                                  className={`mt-0.5 text-[11px] ${
                                    enabled
                                      ? "text-emerald-700"
                                      : checking
                                        ? "text-slate-500"
                                        : "text-amber-800"
                                  }`}
                                >
                                  {item.message}
                                  {enabled && item.earliestTime
                                    ? ` · ${item.earliestTime}`
                                    : ""}
                                </div>
                              </div>
                              <a
                                href={splunkDataModelManagerUrl(item)}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`${
                                  enabled ? "Open" : "Accelerate"
                                } ${item.label} data model`}
                                className="mt-0.5 inline-flex h-7 items-center gap-1 rounded border border-slate-300 bg-white px-2 font-bold text-sky-700 hover:border-sky-400 hover:text-sky-900"
                              >
                                {enabled ? "Open" : "Accelerate"}
                                <ExternalLink size={11} />
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  ))}
                </div>
              </section>

              <details className="group overflow-hidden rounded-lg border border-slate-200 bg-white">
                <summary className="flex min-h-14 cursor-pointer list-none items-center px-4 text-sm font-bold text-slate-800 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                  <span>
                    <span className="block text-[10px] uppercase tracking-wide text-slate-500">
                      Optional
                    </span>
                    Advanced tuning
                  </span>
                  <ChevronDown
                    size={16}
                    className="ml-auto transition-transform group-open:rotate-180"
                  />
                </summary>
                <div className="grid gap-2 border-t border-slate-200 p-4 text-xs text-slate-600">
                  <p>
                    Run CIM discovery, tune external-app macros, inspect raw
                    SPL, or use per-macro diagnostics after setup.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={splunkAppViewUrl("macro_index_tuning")}
                      className={`${compactButtonBase} border-slate-300 bg-white text-slate-700 hover:border-sky-400 hover:text-sky-700`}
                    >
                      Open full tuner
                    </a>
                    <a
                      href={openSearchUrl || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-disabled={!openSearchUrl}
                      className={`${compactButtonBase} border-slate-300 bg-white text-slate-700 hover:border-sky-400 hover:text-sky-700 ${
                        openSearchUrl ? "" : "pointer-events-none opacity-55"
                      }`}
                    >
                      <ExternalLink size={14} />
                      Open in Search
                    </a>
                  </div>
                </div>
              </details>
            </aside>
          </div>
        </div>

        <section
          aria-label="Initial setup actions"
          className="fixed bottom-0 left-0 right-0 z-[80] flex flex-wrap items-center justify-between gap-3 border-t border-slate-300 bg-white/95 px-6 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.14)] backdrop-blur md:left-[72px]"
        >
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-sky-800">
              Step 3 of 3 · {setupScanReady ? "Ready to finish" : scanState === "error" ? "Ready to finish without tuning" : "Scanning"}
            </div>
            <div className="mt-0.5 text-xs text-slate-600">
              {setupActionMessage}
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
                : "Save and finish setup"}
            </button>
          </div>
        </section>
      </main>
    );
  }

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
                saves detected SCD and installed-app routing macros and unlocks
                the landing page; optional CIM macros can be tuned later.
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
                : scanState === "loading"
                  ? "Waiting for the automatic index scan to finish."
                  : scanState === "error"
                    ? "The index scan did not complete. Finish setup now and retry macro tuning later."
                  : `${setupRowsToSave.length} detected routing macro${
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

      <section
        aria-labelledby="external-app-macro-readiness-heading"
        className="mb-4 overflow-hidden rounded-lg border border-sky-200 bg-sky-50/50"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-sky-700">
              Cisco app macro coverage
            </div>
            <h2
              id="external-app-macro-readiness-heading"
              className="mt-1 text-base font-bold text-slate-900"
            >
              Tune app-owned routing macros from this dashboard
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              The fast scan proposes definitions only for enabled companion apps
              installed in this Splunk environment.
            </p>
          </div>
          <a
            href="#external-app-macro-definitions"
            className={`${compactButtonBase} border-sky-300 bg-white text-sky-700 hover:border-sky-500 hover:text-sky-900`}
          >
            Review app macros
            <ChevronDown size={14} />
          </a>
        </div>

        {isLoading && externalAppMacroRows.length === 0 ? (
          <div className="flex min-h-28 items-center justify-center gap-3 border-t border-sky-200 bg-white text-sm text-slate-600">
            <Loader2 size={18} className="animate-spin text-sky-700" />
            Checking Cisco app macro coverage...
          </div>
        ) : (
          <div
            className="grid gap-3 border-t border-sky-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-4"
            role="list"
            aria-label="Cisco app-owned routing macro coverage"
          >
            {externalAppMacroSummaries.map((summary) => {
              const managerLink = externalAppMacroManagerLinks.find(
                (item) => item.targetApp === summary.targetApp,
              );
              const hasMatchingData = summary.matchedMacroCount > 0;
              return (
                <article
                  key={summary.targetApp}
                  role="listitem"
                  className={`rounded-md border p-3 ${
                    hasMatchingData
                      ? "border-emerald-200 bg-emerald-50/50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {hasMatchingData ? (
                      <Check
                        size={16}
                        className="mt-0.5 shrink-0 text-emerald-700"
                      />
                    ) : (
                      <Info
                        size={16}
                        className="mt-0.5 shrink-0 text-slate-500"
                      />
                    )}
                    <div className="min-w-0">
                      <h3 className="m-0 truncate text-sm font-bold text-slate-900">
                        {summary.label}
                      </h3>
                      <code
                        className="mt-1 block truncate font-mono text-[10px] text-slate-500"
                        title={summary.targetApp}
                      >
                        {summary.targetApp}
                      </code>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="font-bold text-slate-900">
                        {formatNumber(summary.rows.length)} macros
                      </div>
                      <div className="mt-0.5 text-slate-500">
                        {formatNumber(summary.matchedMacroCount)} with data
                      </div>
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">
                        {formatNumber(summary.indexCount)} indexes
                      </div>
                      <div className="mt-0.5 text-slate-500">
                        {formatNumber(summary.eventCount)} events
                      </div>
                    </div>
                  </div>
                  <div
                    className={`mt-3 text-xs font-semibold ${
                      hasMatchingData ? "text-emerald-700" : "text-slate-600"
                    }`}
                  >
                    {hasMatchingData
                      ? "Detected data is ready to review"
                      : "No matching data in this range"}
                  </div>
                  {managerLink && (
                    <a
                      href={managerLink.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-sky-700 hover:text-sky-900"
                    >
                      Manage macros
                      <ExternalLink size={11} />
                    </a>
                  )}
                </article>
              );
            })}
          </div>
        )}
        {appInventoryError && (
          <div className="border-t border-sky-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {appInventoryError}
          </div>
        )}
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
                . Authentication, Network Traffic, and every installed Cisco
                Data Center Networking model are strongly recommended for faster
                app searches.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={openAccelerationSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open acceleration check in Search"
                className={`${compactButtonBase} border-slate-300 bg-white text-sky-700 hover:border-sky-400 hover:text-sky-900`}
              >
                <ExternalLink size={13} />
                Open in Search
              </a>
              <a
                href={DATA_MODEL_ACCELERATION_DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open Splunk ${SPLUNK_DOCS_VERSION} data model acceleration documentation`}
                className={`${compactButtonBase} border-slate-300 bg-white text-sky-700 hover:border-sky-400 hover:text-sky-900`}
              >
                <ExternalLink size={13} />
                Acceleration guide
              </a>
              <button
                type="button"
                onClick={checkDataModelAcceleration}
                disabled={accelerationCheckInProgress}
                className={`${compactButtonBase} border-slate-300 bg-white text-slate-700 hover:border-sky-400 hover:text-sky-700`}
              >
                <RefreshCw
                  size={14}
                  className={accelerationCheckInProgress ? "animate-spin" : ""}
                />
                Check again
              </button>
            </div>
          </div>

          <div
            className={`mt-3 rounded-md px-3 py-2 text-xs font-semibold ${
              accelerationCheckInProgress
                ? "bg-sky-100 text-sky-800"
                : dataModelsNeedingAttention.length
                  ? "bg-amber-100 text-amber-900"
                  : "bg-emerald-100 text-emerald-800"
            }`}
            role="status"
          >
            {accelerationCheckInProgress
              ? "Checking recommended data models…"
              : dataModelsNeedingAttention.length
                ? `${acceleratedDataModelCount} of ${dataModelReadiness.length} accelerated · ${dataModelsNeedingAttention.length} need attention`
                : `All ${dataModelReadiness.length} recommended data models are accelerated.`}
          </div>

          <div
            className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3"
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
                      <AlertTriangle className="mt-0.5 shrink-0" size={14} />
                    )}
                    <span>{item.message}</span>
                  </div>
                  {enabled && item.earliestTime && (
                    <div className="mt-1 text-[11px] text-slate-500">
                      Acceleration range: {item.earliestTime}
                    </div>
                  )}
                  <a
                    href={splunkDataModelManagerUrl(item)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:text-sky-900"
                  >
                    {enabled ? "Open data model" : "Accelerate data model"}
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
                <code className="font-mono">summariesonly=true</code> cannot be
                saved yet. Enable acceleration for all three required Cisco data
                models, then check again.
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
                <code className="font-mono">summariesonly=false</code> may fall
                back to raw events while acceleration is being prepared.
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
            tunable routing macros
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
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="flex items-start gap-2">
            <Search size={17} className="mt-0.5 shrink-0 text-sky-700" />
            <div>
              <h2 className="m-0 text-base font-bold text-slate-900">
                Dashboard index macro definitions
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Macros owned by {APP_NAME}. This search also filters the Cisco
                app section below.
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <label
              htmlFor="macro-index-tuning-search"
              className="relative min-w-0 w-full lg:max-w-2xl"
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
            <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
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
            </div>
          </div>
        </div>

        {isLoading && dashboardMacroRows.length === 0 ? (
          <div className="flex min-h-[260px] items-center justify-center gap-3 text-sm text-slate-600">
            <Loader2 size={18} className="animate-spin text-sky-700" />
            Scanning indexes and sourcetypes...
          </div>
        ) : dashboardMacroRows.length === 0 ? (
          <div className="min-h-[220px] px-4 py-12 text-center text-sm text-slate-500">
            No dashboard macro rows returned for the selected range.
          </div>
        ) : filteredDashboardMacroRows.length === 0 ? (
          <div className="min-h-[220px] px-4 py-12 text-center text-sm text-slate-500">
            No dashboard macro rows match the current search.
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
              <tbody>{renderTableRows(filteredDashboardMacroGroups)}</tbody>
            </table>
          </div>
        )}
      </section>

      <section
        id="external-app-macro-definitions"
        aria-labelledby="external-app-macro-definitions-heading"
        className="mb-4 scroll-mt-4 border border-sky-200 bg-white"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-sky-200 bg-sky-50/50 px-4 py-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-sky-700">
              Installed Cisco apps
            </div>
            <h2
              id="external-app-macro-definitions-heading"
              className="mt-1 text-base font-bold text-slate-900"
            >
              Cisco app macro definitions
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Edit and save each definition directly to the owning app&apos;s
              local/macros.conf. App IDs remain visible so deployment packages
              can be matched exactly.
            </p>
          </div>
          <div className="rounded-md border border-sky-200 bg-white px-3 py-2 text-xs text-slate-600">
            <span className="font-bold text-slate-900">
              {formatNumber(externalAppMacroRows.length)} macros
            </span>{" "}
            across {formatNumber(externalAppMacroSummaries.length)} Cisco apps
          </div>
        </div>

        {isLoading && externalAppMacroRows.length === 0 ? (
          <div className="flex min-h-[220px] items-center justify-center gap-3 text-sm text-slate-600">
            <Loader2 size={18} className="animate-spin text-sky-700" />
            Scanning app-owned macros...
          </div>
        ) : externalAppMacroRows.length === 0 ? (
          <div className="min-h-[180px] px-4 py-12 text-center text-sm text-slate-500">
            No supported Cisco app macro definitions are available.
          </div>
        ) : filteredExternalAppMacroRows.length === 0 ? (
          <div className="min-h-[180px] px-4 py-12 text-center text-sm text-slate-500">
            No Cisco app macro rows match the current search.
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
              <tbody>{renderTableRows(filteredExternalAppMacroGroups)}</tbody>
            </table>
          </div>
        )}
      </section>

      {isTargetAppInstalled(CIM_APP_NAME) && (
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
              <span className="flex min-w-0 items-center gap-2 normal-case tracking-normal">
                <span className="truncate text-sm font-semibold text-slate-700">
                  {getTargetAppLabel(CIM_APP_NAME)}
                </span>
                <code className="shrink-0 font-mono text-[11px] font-medium text-slate-500">
                  {CIM_APP_NAME}/local/macros.conf
                </code>
              </span>
              <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-slate-500">
                {formatNumber(cimMacroRows.length)} macros
              </span>
            </button>
            {!isCimGroupCollapsed && (
              <p className="mt-1 text-sm text-slate-600">
                CIM data model discovery. Discover all {CIM_MACRO_NAMES.length}{" "}
                Splunk_SA_CIM index macros with their shipped tag-based
                constraints only when needed.
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
              {isCimLoading ? "Running" : "Run all CIM discovery"}
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
            <a
              href={cimMacrosManagerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${lightButtonBase} border-slate-300 bg-white text-slate-700 hover:border-sky-400 hover:text-sky-700`}
            >
              <ExternalLink size={16} />
              Open CIM macros
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
                Discovering indexes for all CIM data models...
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
      )}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
        <details className="border border-slate-200 bg-white">
          <summary className="cursor-pointer border-b border-slate-200 px-4 py-3 text-base font-bold text-slate-900">
            macros.conf preview
          </summary>
          <textarea
            ref={macroPreviewRef}
            readOnly
            value={
              macroStanzas || "# Run the scan to populate macro definitions."
            }
            aria-label="macros.conf preview"
            className="m-0 h-[320px] w-full resize-y overflow-auto border-0 bg-white p-4 font-mono text-xs leading-relaxed text-slate-800 outline-none"
          />
        </details>

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
