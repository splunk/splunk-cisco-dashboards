/* eslint-disable react/jsx-filename-extension */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    Activity,
    AlertTriangle,
    Check,
    CheckCircle2,
    Copy,
    Database,
    Download,
    ExternalLink,
    FileSearch,
    Gauge,
    GitBranch,
    Layers,
    LifeBuoy,
    Map as MapIcon,
    PlayCircle,
    Search,
    Settings,
    Shield,
    SlidersHorizontal,
    Wifi,
} from '@/common/icons/SuiIcon';
import { APP_VERSION_LABEL } from "@/common/lib/buildInfo";

import "./user-guide.css";

const APP_NAME = "splunk-cisco-dashboards";

const getSplunkLocale = (): string => {
  if (typeof window === "undefined") {
    return "en-US";
  }
  const localeMatch = window.location.pathname.match(
    /^\/([a-z]{2}-[A-Z]{2})\//,
  );
  return localeMatch ? localeMatch[1] : "en-US";
};

const appUrl = (view: string): string =>
  `/${getSplunkLocale()}/app/${APP_NAME}/${view}`;
const managerUrl = (app: string, page: string): string =>
  `/${getSplunkLocale()}/manager/${encodeURIComponent(app)}/${page}`;
const searchUrl = (q: string): string =>
  `/${getSplunkLocale()}/app/${APP_NAME}/search?q=${encodeURIComponent(q)}`;

const sectionLinkBase =
  "inline-flex h-9 items-center gap-2 rounded border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-sky-400 hover:text-sky-700";

const GUIDE_GROUPS = [
  {
    label: "Start",
    sections: [
      { id: "overview", label: "Overview" },
      { id: "prerequisites", label: "Prerequisites" },
      { id: "install", label: "Day-One Setup" },
    ],
  },
  {
    label: "Configure",
    sections: [
      { id: "macro-tuning", label: "Macro Tuning" },
      { id: "data-sources", label: "Data Sources" },
    ],
  },
  {
    label: "Explore",
    sections: [
      { id: "dashboards", label: "Dashboard Map" },
      { id: "workspaces", label: "Insights Workspaces" },
      { id: "site-connectivity", label: "Site Connectivity" },
      { id: "lookups", label: "Supporting Assets" },
    ],
  },
  {
    label: "Operate",
    sections: [
      { id: "operations", label: "Operations" },
      { id: "troubleshooting", label: "Troubleshooting" },
      { id: "release-notes", label: "Release Notes" },
    ],
  },
];

const GUIDE_SECTIONS = GUIDE_GROUPS.flatMap((group) =>
  group.sections.map((section) => ({ ...section, group: group.label })),
);

const SEARCHABLE_SELECTOR = "h2, h3, p, li, td, th";

const sectionNumber = (id: string): number =>
  GUIDE_SECTIONS.findIndex((section) => section.id === id) + 1;

const headingSlug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "heading";

function GuideLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={sectionLinkBase}
    >
      {children}
      <ExternalLink size={15} />
    </a>
  );
}

function Section({
  id,
  title,
  kicker,
  icon,
  children,
}: {
  id: string;
  title: string;
  kicker?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section
      id={id}
      data-guide-section={id}
      className="scd-guide-section scroll-mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-sky-100 bg-sky-50 text-sky-700">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-sky-700">
              Section {sectionNumber(id)}
            </div>
            <h2 className="m-0 text-xl font-bold text-slate-950">{title}</h2>
            {kicker && <p className="mt-1 text-sm text-slate-600">{kicker}</p>}
          </div>
        </div>
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="border border-slate-200 bg-slate-50 p-4">
      <h3 className="m-0 text-sm font-bold uppercase tracking-wide text-slate-600">
        {title}
      </h3>
      <div className="mt-3 text-sm leading-6 text-slate-700">{children}</div>
    </div>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }): JSX.Element {
  const [copied, setCopied] = useState(false);
  const code = typeof children === "string" ? children : String(children ?? "");

  const copyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch (_error) {
      const textArea = document.createElement("textarea");
      textArea.value = code;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      textArea.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }, [code]);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
      <div className="scd-guide-no-print flex items-center justify-between border-b border-slate-700 bg-slate-900 px-3 py-2">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
          Configuration example
        </span>
        <button
          type="button"
          onClick={copyCode}
          className="inline-flex items-center gap-1.5 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-200 hover:border-sky-500 hover:text-white"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="scd-guide-code-pre m-0 overflow-auto p-4 font-mono text-xs leading-6 text-slate-100">
        {code}
      </pre>
    </div>
  );
}

function GuideContents({
  activeSection,
  clearSearch,
  currentSearchIndex,
  goToSection,
  nextSearchMatch,
  searchMatches,
  searchQuery,
  searchStatus,
  setSearchQuery,
}: {
  activeSection: string;
  clearSearch: () => void;
  currentSearchIndex: number;
  goToSection: (id: string) => void;
  nextSearchMatch: () => void;
  searchMatches: number;
  searchQuery: string;
  searchStatus: string;
  setSearchQuery: (value: string) => void;
}): JSX.Element {
  return (
    <nav
      className="scd-guide-toc scd-guide-no-print"
      aria-label="User guide contents"
    >
      <div className="scd-guide-toc-header">
        <div className="scd-guide-toc-eyebrow">User Guide</div>
        <div className="scd-guide-toc-title">Contents</div>
      </div>

      <div className="scd-guide-search">
        <div className="scd-guide-search-input-wrap">
          <Search size={16} aria-hidden="true" />
          <input
            id="scd-guide-search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                nextSearchMatch();
              }
            }}
            placeholder="Search guide"
            aria-label="Search user guide"
            className="scd-guide-search-input"
          />
        </div>
        <div className="scd-guide-search-actions">
          <span className="scd-guide-search-status" aria-live="polite">
            {searchStatus}
            {searchMatches > 0 && (
              <span className="scd-guide-search-count">
                {currentSearchIndex + 1}/{searchMatches}
              </span>
            )}
          </span>
          <button
            type="button"
            disabled={searchMatches < 2}
            onClick={nextSearchMatch}
            className="scd-guide-search-button"
          >
            Next
          </button>
          <button
            type="button"
            disabled={!searchQuery}
            onClick={clearSearch}
            className="scd-guide-search-button"
          >
            Clear
          </button>
        </div>
      </div>

      <ol className="scd-guide-toc-list">
        {GUIDE_GROUPS.map((group) => (
          <React.Fragment key={group.label}>
            <li className="scd-guide-toc-group" role="presentation">
              {group.label}
            </li>
            {group.sections.map((section) => {
              const number = sectionNumber(section.id);
              const active = section.id === activeSection;
              return (
                <li
                  key={section.id}
                  className={`scd-guide-toc-item${
                    active ? " scd-guide-toc-item-active" : ""
                  }`}
                >
                  <button
                    type="button"
                    aria-current={active ? "location" : undefined}
                    onClick={() => goToSection(section.id)}
                    className="scd-guide-toc-link"
                  >
                    <span className="scd-guide-toc-chip">{number}</span>
                    <span className="scd-guide-toc-text">{section.label}</span>
                  </button>
                </li>
              );
            })}
          </React.Fragment>
        ))}
      </ol>

      <div className="scd-guide-toc-footer">
        <a
          href={appUrl("macro_index_tuning")}
          className="scd-guide-toc-quicklink"
        >
          Macro Index Tuning →
        </a>
        <a
          href={appUrl("searchbase_canvas")}
          className="scd-guide-toc-quicklink"
        >
          Searchbase Canvas →
        </a>
      </div>
    </nav>
  );
}

function GuidePageToc({
  activeHeading,
  activeSection,
  entries,
  goToHeading,
}: {
  activeHeading: string;
  activeSection: string;
  entries: Array<{ id: string; label: string; level: number }>;
  goToHeading: (id: string) => void;
}): JSX.Element {
  return (
    <aside
      className="scd-guide-page-toc scd-guide-no-print"
      aria-label="On this page"
    >
      <div className="scd-guide-page-toc-kicker">This section</div>
      <div className="scd-guide-page-toc-title">On this page</div>
      <ol className="scd-guide-page-toc-list">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className={`scd-guide-page-toc-item scd-guide-page-toc-level-${entry.level}${
              activeHeading === entry.id
                ? " scd-guide-page-toc-item-active"
                : ""
            }`}
          >
            <button
              type="button"
              className="scd-guide-page-toc-link"
              onClick={() => goToHeading(entry.id)}
            >
              {entry.label}
            </button>
          </li>
        ))}
      </ol>
      <div className="scd-guide-page-toc-footer">
        Section {sectionNumber(activeSection)} of {GUIDE_SECTIONS.length}
      </div>
    </aside>
  );
}

const dashboards = [
  {
    title: "Secure Networking",
    view: "secure_networking_profile",
    summary:
      "Executive landing page with health KPIs, workspace-aware signal rail, topology, and summary tiles.",
  },
  {
    title: "Insights Workspaces",
    view: "insights_workspace",
    summary:
      "Reusable executive views that keep their own sections, tile choices, map placement, and theme.",
  },
  {
    title: "IT Health",
    view: "it_health_v1",
    summary:
      "Catalyst Center, ISE, ThousandEyes, device health, identity, and user experience.",
  },
  {
    title: "Security",
    view: "security_v1",
    summary:
      "Firewall, IPS, DNS, email, web, identity, endpoint, and security event visibility.",
  },
  {
    title: "Building Intelligence",
    view: "building_v1",
    summary:
      "Cisco Spaces, occupancy, building telemetry, wireless trust, and location intelligence.",
  },
  {
    title: "Cisco Spaces Intelligence",
    view: "spaces_intelligence_v1",
    summary:
      "Environmental, capacity, room, activation, visitor, and network impact analytics.",
  },
  {
    title: "Network Activation Report",
    view: "statewide_exercise_v1",
    summary:
      "Event operations view for executive, client, device, traffic, and issue summaries.",
  },
];

const macroFamilies = [
  {
    app: "splunk-cisco-dashboards",
    format: "index IN (idx1, idx2)",
    examples:
      "index_catalyst, index_firewall, index_f5, index_spaces, index_thousandeyes, and the other index_* macros",
    note: "Primary dashboard macros. The fast scan discovers known Cisco sourcetypes with tstats.",
  },
  {
    app: "Splunk_SA_CIM",
    format: "(index=idx1 OR index=idx2)",
    examples: "cim_Authentication_indexes, cim_Network_Traffic_indexes",
    note: "Discovered separately with tag-based searches because CIM tags require raw search work.",
  },
  {
    app: "CiscoSecurityCloud",
    format: "(index=idx1 OR index=idx2) sourcetype=...",
    examples:
      "nvm_sysdata_index, nvm_process_index, nvm_flowdata_index, nvm_combined_index",
    note: "Used by the Cisco Security Cloud app data models.",
  },
  {
    app: "ta_cisco_thousandeyes",
    format: "(index=idx1 OR index=idx2)",
    examples:
      "stream_index, path_viz_index, activity_index, event_index, trace_index, alert_index",
    note: "Used by Cisco ThousandEyes data models and tstats-backed panels.",
  },
];

const dependencyApps = [
  {
    name: "Cisco Security Cloud",
    folder: "CiscoSecurityCloud",
    splunkbase: "https://splunkbase.splunk.com/app/7404",
    models: "Cisco_Security",
    usage:
      "Required for Cisco Security Cloud data model macros and security model-backed content.",
  },
  {
    name: "Cisco ThousandEyes App for Splunk",
    folder: "ta_cisco_thousandeyes",
    splunkbase: "https://splunkbase.splunk.com/app/7719",
    models: "Cisco_ThousandEyes",
    usage:
      "Required for ThousandEyes data model macros and tstats-backed ThousandEyes panels.",
  },
  {
    name: "Cisco Enterprise Networking for Splunk Platform",
    folder: "cisco-catalyst-app",
    splunkbase: "https://splunkbase.splunk.com/app/7539",
    models: "Cisco_Catalyst_App",
    usage:
      "Provides Cisco Catalyst datasets for network health, device health, client inventory, active issues, authentication, audit, alarms, SD-WAN, ISE, Meraki, NetFlow, and related Catalyst events.",
  },
  {
    name: "Splunk AI Toolkit",
    folder: "Splunk AI Toolkit",
    splunkbase: "https://splunkbase.splunk.com/app/2890",
    models: "N/A",
    usage:
      "Required by searches that use Splunk AI or Machine Learning Toolkit commands such as fit and apply.",
  },
];

const dataSources = [
  [
    "Catalyst Center",
    "`cisco:dnac:*`, `cisco:catalyst:center:*`",
    "`index_catalyst`",
  ],
  [
    "Firewall",
    "`cisco:asa`, `cisco:ftd*`, `cisco:sfw:estreamer`, `cisco:sfw:policy`, `cisco:sourcefire:*`, `cisco:estreamer:*`, `cisco:multicloud:defense:*`",
    "`index_firewall`",
  ],
  [
    "Identity",
    "`cisco:ise:*`, Windows and Active Directory sourcetypes",
    "`index_identity`, `index_windows`",
  ],
  [
    "Network infrastructure",
    "`cisco:ios`, `cisco:ios:*`, `cisco:telemetry`, network syslog",
    "`index_network`",
  ],
  [
    "Zeek NSM",
    "`zeek:conn`, `zeek:dns`, `zeek:ssl`, `zeek:http`, `zeek:notice`, and related Zeek logs",
    "`index_zeek`",
  ],
  ["Meraki", "`meraki:*`", "`index_meraki`"],
  ["Cisco Spaces", "`cisco:spaces:*`", "`index_spaces`"],
  [
    "Security stack",
    "XDR, Umbrella/Secure Access, ESA, WSA, ETD, SMA, CVI, Isovalent, AI Defense (`cisco:ai:defense*`), Secure Workload, SCA, Secure Endpoint, Defender",
    "`index_security`",
  ],
  ["DHCP", "Windows DHCP Server logs such as `DhcpSrvLog`", "`index_dhcp`"],
  [
    "ThousandEyes",
    "`cisco:thousandeyes:*` plus TA data model macros",
    "`index_thousandeyes`",
  ],
  ["F5 BIG-IP", "`f5:bigip:*`", "`index_f5`"],
  ["Duo", "`cisco:duo:*`", "`index_duo`"],
  ["CyberVision", "`cisco:cybervision:*`", "`index_cybervision`"],
  ["UCS", "`cisco:ucs`, `cisco:ucs:*`", "`index_ucs`"],
  [
    "Intersight",
    "`cisco:intersight:*` (advisories, inventory, and related feeds)",
    "`index_intersight`",
  ],
  [
    "Cisco SD-WAN",
    "`cisco:sdwan:*` including UTD health and logs",
    "`index_sdwan`",
  ],
  [
    "Data Center",
    "`cisco:dc:aci:*`, `cisco:dc:nd:*`, `cisco:dc:nexus9k`",
    "`index_dc`",
  ],
  ["Network Visibility Module", "`cisco:nvm:*`", "`index_nvm`"],
];

const supportMacros = [
  [
    "`customer_name`",
    "Controls the organization name shown in dashboard headers and report titles.",
  ],
  [
    "`scd_summariesonly`",
    "Controls tstats acceleration behavior for searches that can use accelerated data models.",
  ],
  [
    "`spaces_hierarchy(1)`",
    "Normalizes Cisco Spaces location hierarchy into campus, building, floor, and site fields.",
  ],
  [
    "`wireless_trust_base`",
    "Shared base search for wireless trust summary and device review panels.",
  ],
  [
    "`dnac_site_normalize(1)`",
    "Normalizes Catalyst Center site labels used across device and client panels.",
  ],
  ["`nrs_w_nrs_a`", "Network readiness score availability weight."],
  ["`nrs_w_nrs_r`", "Network readiness score reachability weight."],
  ["`nrs_w_nrs_q`", "Network readiness score quality weight."],
  [
    "`nrs_th_ap_health`",
    "Access point health threshold for readiness scoring.",
  ],
  ["`nrs_th_cl_health`", "Client health threshold for readiness scoring."],
  [
    "`nrs_ap_saturation_clients`",
    "AP client saturation threshold for readiness scoring.",
  ],
  [
    "`field_list`",
    "Utility macro used where dashboard searches need a reusable field projection.",
  ],
];

const troubleshootingRows = [
  [
    "Panels are empty",
    "Run Macro Index Tuning first, verify the time range, then open the panel in Search.",
  ],
  [
    "Searches are slow",
    "Tighten macros away from index=*, keep CIM discovery ranges short, and check tstats acceleration.",
  ],
  [
    "CIM panels are blank",
    "Run the CIM discovery section and save macros into Splunk_SA_CIM/local/macros.conf.",
  ],
  [
    "Site names are missing",
    "Refresh site_topology_lookup and verify client events carry siteId, siteHierarchyId, or siteHierarchy.",
  ],
  [
    "ThousandEyes links do not open",
    "Confirm permalink fields are absolute URLs and external navigation is allowed by Splunk Web.",
  ],
];

export default function UserGuidePage(): JSX.Element {
  const macroTuningUrl = appUrl("macro_index_tuning");
  const setupUrl = `${appUrl("start")}?setup=1`;
  const workspaceUrl = appUrl("insights_workspace");
  const secureNetworkingUrl = appUrl("secure_networking_profile");
  const scdMacrosUrl = managerUrl(APP_NAME, "data/macros");
  const cimMacrosUrl = managerUrl("Splunk_SA_CIM", "data/macros");
  const guideContentRef = useRef<HTMLDivElement | null>(null);
  const matchesRef = useRef<HTMLElement[]>([]);
  const currentSearchIndexRef = useRef(-1);
  const [activeSection, setActiveSection] = useState<string>(
    GUIDE_SECTIONS[0].id,
  );
  const [activeHeading, setActiveHeading] = useState<string>(
    GUIDE_SECTIONS[0].id,
  );
  const [pageTocBySection, setPageTocBySection] = useState(() => new Map());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchStatus, setSearchStatus] = useState("");
  const [searchMatches, setSearchMatches] = useState(0);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);

  const clearSearchClasses = useCallback(() => {
    matchesRef.current.forEach((node) => {
      node.classList.remove(
        "scd-guide-search-match",
        "scd-guide-search-current",
      );
    });
    matchesRef.current = [];
    currentSearchIndexRef.current = -1;
    setSearchMatches(0);
    setCurrentSearchIndex(-1);
  }, []);

  const showSearchMatch = useCallback(
    (index: number, shouldScroll = true) => {
      const matches = matchesRef.current;
      if (!matches.length) {
        setSearchStatus(searchQuery.trim() ? "No matches" : "");
        return;
      }

      const previous = matches[currentSearchIndexRef.current];
      previous?.classList.remove("scd-guide-search-current");

      const nextIndex = (index + matches.length) % matches.length;
      const match = matches[nextIndex];
      currentSearchIndexRef.current = nextIndex;
      match.classList.add("scd-guide-search-current");
      setCurrentSearchIndex(nextIndex);
      setSearchStatus(
        `${matches.length} ${matches.length === 1 ? "match" : "matches"}`,
      );

      const section = match.closest<HTMLElement>("[data-guide-section]");
      if (section?.dataset.guideSection) {
        setActiveSection(section.dataset.guideSection);
        setActiveHeading(
          match.closest<HTMLElement>("h3[id], h4[id]")?.id ||
            section.dataset.guideSection,
        );
      }
      if (shouldScroll) {
        match.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    },
    [searchQuery],
  );

  const runSearch = useCallback(
    (query: string) => {
      clearSearchClasses();
      const normalizedQuery = query.trim().toLowerCase();
      if (!normalizedQuery || !guideContentRef.current) {
        setSearchStatus("");
        return;
      }

      const matches = Array.from(
        guideContentRef.current.querySelectorAll<HTMLElement>(
          SEARCHABLE_SELECTOR,
        ),
      ).filter((node) =>
        node.textContent?.toLowerCase().includes(normalizedQuery),
      );

      matches.forEach((node) => node.classList.add("scd-guide-search-match"));
      matchesRef.current = matches;
      setSearchMatches(matches.length);

      if (matches.length) {
        showSearchMatch(0);
      } else {
        setSearchStatus("No matches");
      }
    },
    [clearSearchClasses, showSearchMatch],
  );

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setSearchStatus("");
    clearSearchClasses();
  }, [clearSearchClasses]);

  const nextSearchMatch = useCallback(() => {
    if (!matchesRef.current.length) {
      runSearch(searchQuery);
      return;
    }
    showSearchMatch(currentSearchIndexRef.current + 1);
  }, [runSearch, searchQuery, showSearchMatch]);

  const goToSection = useCallback((id: string) => {
    const section = document.getElementById(id);
    if (!section) {
      return;
    }
    setActiveSection(id);
    setActiveHeading(id);
    section.scrollIntoView({ behavior: "auto", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
  }, []);

  const goToHeading = useCallback((id: string) => {
    const target = document.getElementById(id);
    if (!target) {
      return;
    }
    const section = target.matches("[data-guide-section]")
      ? target
      : target.closest<HTMLElement>("[data-guide-section]");
    if (section?.dataset.guideSection) {
      setActiveSection(section.dataset.guideSection);
    }
    setActiveHeading(id);
    target.scrollIntoView({ behavior: "auto", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
  }, []);

  const exportPdf = useCallback(() => {
    const previousTitle = document.title;
    const cleanup = () => {
      document.body.classList.remove("scd-guide-printing");
      document.title = previousTitle;
      window.removeEventListener("afterprint", cleanup);
    };

    document.body.classList.add("scd-guide-printing");
    document.title = `Splunk App for Secure Networking User Guide ${APP_VERSION_LABEL}`;
    window.addEventListener("afterprint", cleanup);
    window.setTimeout(() => {
      window.print();
      cleanup();
    }, 50);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => runSearch(searchQuery), 140);
    return () => window.clearTimeout(timer);
  }, [runSearch, searchQuery]);

  useEffect(() => () => clearSearchClasses(), [clearSearchClasses]);

  useEffect(() => {
    const tocBySection = new Map();

    GUIDE_SECTIONS.forEach((sectionDefinition) => {
      const section = document.getElementById(sectionDefinition.id);
      if (!section) {
        return;
      }

      const sectionTitle =
        section.querySelector("h2")?.textContent?.trim() ||
        sectionDefinition.label;
      const entries: Array<{ id: string; label: string; level: number }> = [
        {
          id: sectionDefinition.id,
          label: sectionTitle,
          level: 2,
        },
      ];
      const seenIds = new Set<string>();

      section.querySelectorAll<HTMLElement>("h3, h4").forEach((heading) => {
        const label = heading.textContent?.trim();
        if (!label) {
          return;
        }
        const baseId = `${sectionDefinition.id}-${headingSlug(label)}`;
        let id = baseId;
        let suffix = 2;
        while (
          seenIds.has(id) ||
          (document.getElementById(id) && heading.id !== id)
        ) {
          id = `${baseId}-${suffix}`;
          suffix += 1;
        }
        seenIds.add(id);
        heading.setAttribute("id", id);
        heading.setAttribute("data-guide-page-heading", "true");
        entries.push({
          id,
          label,
          level: Number(heading.tagName.slice(1)),
        });
      });

      tocBySection.set(sectionDefinition.id, entries);
    });

    setPageTocBySection(tocBySection);
  }, []);

  useEffect(() => {
    const sections = GUIDE_SECTIONS.map((section) =>
      document.getElementById(section.id),
    ).filter((section): section is HTMLElement => Boolean(section));

    let frame = 0;
    const updateActiveSection = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const active =
          [...sections]
            .reverse()
            .find((section) => section.getBoundingClientRect().top <= 220) ||
          sections[0];
        if (active) {
          setActiveSection(active.id);
          const headingNodes = [
            active,
            ...Array.from(
              active.querySelectorAll<HTMLElement>("[data-guide-page-heading]"),
            ),
          ];
          const visibleHeading =
            [...headingNodes]
              .reverse()
              .find((heading) => heading.getBoundingClientRect().top <= 220) ||
            active;
          setActiveHeading(visibleHeading.id);
        }
      });
    };

    updateActiveSection();
    document.addEventListener("scroll", updateActiveSection, true);
    window.addEventListener("resize", updateActiveSection);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("scroll", updateActiveSection, true);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, []);

  return (
    <main className="scd-user-guide min-h-screen bg-slate-100 text-slate-900">
      <div className="scd-guide-layout">
        <GuideContents
          activeSection={activeSection}
          clearSearch={clearSearch}
          currentSearchIndex={currentSearchIndex}
          goToSection={goToSection}
          nextSearchMatch={nextSearchMatch}
          searchMatches={searchMatches}
          searchQuery={searchQuery}
          searchStatus={searchStatus}
          setSearchQuery={setSearchQuery}
        />

        <article className="scd-guide-document grid gap-5">
          <header className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-sky-700">
                  <LifeBuoy size={15} />
                  User Guide
                </div>
                <h1 className="m-0 text-3xl font-bold tracking-normal text-slate-950">
                  Splunk App for Secure Networking
                </h1>
              </div>
              <button
                type="button"
                onClick={exportPdf}
                title="Open the browser print dialog to save this guide as PDF"
                className="scd-guide-no-print inline-flex h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-sky-700 shadow-sm hover:border-sky-400 hover:bg-sky-50"
              >
                <Download size={17} />
                Export PDF
              </button>
            </div>

            <p className="mt-5 max-w-4xl text-lg leading-8 text-slate-700">
              Setup and operating guide for deploying the app, tuning macros,
              validating data sources, and keeping the executive dashboards
              useful after the first install.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-200 pt-4 text-sm text-slate-600">
              <span>
                <strong className="text-slate-800">Version:</strong>{" "}
                {APP_VERSION_LABEL}
              </span>
              <span>
                <strong className="text-slate-800">License:</strong> Apache-2.0
              </span>
            </div>
            <div className="scd-guide-no-print mt-5 flex flex-wrap gap-2">
              <GuideLink href={macroTuningUrl}>
                <SlidersHorizontal size={15} />
                Macro Index Tuning
              </GuideLink>
              <GuideLink
                href={searchUrl(
                  "| tstats count where index=* by index sourcetype",
                )}
              >
                <Search size={15} />
                Open Data Check
              </GuideLink>
            </div>
          </header>

          <div ref={guideContentRef} className="grid gap-5">
            <Section
              id="overview"
              title="What This App Provides"
              kicker="Cisco-focused executive, operational, workplace, security, and event dashboards."
              icon={<Gauge size={19} />}
            >
              <div className="grid gap-4 md:grid-cols-3">
                <InfoCard title="Executive summaries">
                  Health KPIs, topology, client experience, security, building
                  intelligence, and event operations views designed for fast
                  situation awareness.
                </InfoCard>
                <InfoCard title="Operational depth">
                  Tabs expose source-specific detail for Catalyst Center, Cisco
                  Spaces, ThousandEyes, ISE, firewall, endpoint, and related
                  telemetry.
                </InfoCard>
                <InfoCard title="Tunable search model">
                  Searches call macros instead of hardcoded indexes so the same
                  dashboard package can run cleanly in different Splunk
                  environments.
                </InfoCard>
              </div>
            </Section>

            <Section
              id="prerequisites"
              title="Prerequisites"
              kicker="Install these apps and prepare their data models before tuning macros or validating data model-backed panels."
              icon={<GitBranch size={19} />}
            >
              <div className="overflow-x-auto">
                <table className="min-w-[1180px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <th className="w-[22%] px-3 py-2 font-bold">
                        Dependency
                      </th>
                      <th className="w-[18%] px-3 py-2 font-bold">
                        App Folder
                      </th>
                      <th className="w-[24%] px-3 py-2 font-bold">
                        Splunkbase
                      </th>
                      <th className="w-[16%] px-3 py-2 font-bold">
                        Data Model
                      </th>
                      <th className="w-[20%] px-3 py-2 font-bold">
                        How SCD Uses It
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dependencyApps.map((app) => (
                      <tr
                        key={app.name}
                        className="border-b border-slate-100 align-top"
                      >
                        <td className="px-3 py-3 font-bold text-slate-800">
                          {app.name}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-slate-700">
                          {app.folder}
                        </td>
                        <td className="px-3 py-3">
                          <a
                            href={app.splunkbase}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-mono text-xs font-bold text-sky-800 hover:text-sky-600"
                          >
                            {app.splunkbase}
                            <ExternalLink size={13} />
                          </a>
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-slate-700">
                          {app.models}
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {app.usage}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Splunk App for Secure Networking currently uses the Cisco
                Security Cloud and Cisco ThousandEyes data models, and will use
                the Cisco_Catalyst_App data model from Cisco Enterprise
                Networking for Splunk Platform. For best performance, the data
                models in those three Cisco apps are expected to be accelerated
                when you enable their related content.
              </p>
            </Section>

            <Section
              id="install"
              title="Day-One Setup"
              kicker="Use the guided setup to validate packages, tune index macros, and choose a search-performance mode."
              icon={<PlayCircle size={19} />}
            >
              <ol className="m-0 grid gap-3 pl-5 text-sm leading-6 text-slate-700">
                <li>
                  Install the app, Splunk Common Information Model, Splunk AI
                  Toolkit, and the Cisco apps that provide required data models.
                </li>
                <li>
                  Confirm events are present with a broad data check before
                  tuning dashboards.
                </li>
                <li>
                  Open the guided setup. It checks the required apps, detects
                  Cisco sourcetypes, and proposes the index macro definitions
                  used by this app and its companion apps.
                </li>
                <li>
                  Review and save the generated macro definitions. The setup
                  keeps balanced mode available while acceleration catches up;
                  accelerated-summaries-only mode remains guarded by its data
                  model prerequisites.
                </li>
                <li>
                  Run CIM discovery separately with a short range, then save the
                  CIM macros into Splunk_SA_CIM.
                </li>
                <li>
                  Open the data-model readiness card to see which models need
                  acceleration, then use Open in Search to inspect the exact
                  readiness query or an empty dashboard panel.
                </li>
              </ol>
              <div className="mt-4 flex flex-wrap gap-2">
                <GuideLink href={setupUrl}>
                  <PlayCircle size={15} />
                  Open Guided Setup
                </GuideLink>
                <GuideLink href={macroTuningUrl}>
                  <SlidersHorizontal size={15} />
                  Open Macro Index Tuning
                </GuideLink>
                <GuideLink
                  href={searchUrl(
                    "| tstats count where index=* by index sourcetype | sort -count",
                  )}
                >
                  <Database size={15} />
                  Check Sourcetypes
                </GuideLink>
              </div>
            </Section>

            <Section
              id="macro-tuning"
              title="Macro Index Tuning"
              kicker="The most important setup step. It maps your real indexes to the macros the dashboards and data models use."
              icon={<SlidersHorizontal size={19} />}
            >
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="space-y-4 text-sm leading-6 text-slate-700">
                  <p className="m-0">
                    The <strong>Macro Index Tuning</strong> dashboard is a React
                    view mounted by{" "}
                    <code className="rounded bg-slate-100 px-1 py-0.5">
                      macro_index_tuning.xml
                    </code>
                    . The fast scan uses the{" "}
                    <code className="rounded bg-slate-100 px-1 py-0.5">
                      admin_macro_index_tuning
                    </code>
                    searchbase entry, which performs a tstats pass over known
                    Cisco sourcetypes and generates macro definitions. The UI
                    discovers every SCD macro whose name starts with{" "}
                    <code className="rounded bg-slate-100 px-1 py-0.5">
                      index_
                    </code>
                    from this app at runtime, so newly added index macros appear
                    in the scan without updating a hardcoded list. It also
                    centralizes companion macro tuning, including Cisco Data
                    Center Networking, Cisco Security Cloud, and ThousandEyes
                    definitions, so their dashboards are ready when you open
                    them.
                  </p>
                  <p className="m-0">
                    CIM discovery is intentionally separate because it uses
                    tag-based raw searches such as authentication and network
                    communication tags. Keep that range short unless you are
                    validating a new deployment.
                  </p>
                  <p className="m-0">
                    The readiness panel reports acceleration independently of
                    macro detection. Use its <strong>Open in Search</strong>{" "}
                    link to review the REST-backed check, or an individual
                    <strong> Accelerate data model</strong> link to open the
                    matching Data Models manager page.
                  </p>
                  <CodeBlock>{`# SCD macro format
[index_catalyst]
definition = index IN (cisco_catcenter, dnac)
iseval = 0

# CIM and external app format
[cim_Network_Traffic_indexes]
definition = (index=net_firewall OR index=net_flow)
iseval = 0`}</CodeBlock>
                </div>
                <div className="grid gap-3">
                  <InfoCard title="Where saves go">
                    <ul className="m-0 space-y-2 pl-4">
                      <li>
                        SCD macros save to{" "}
                        <code>splunk-cisco-dashboards/local/macros.conf</code>.
                      </li>
                      <li>
                        CIM macros save to{" "}
                        <code>Splunk_SA_CIM/local/macros.conf</code>.
                      </li>
                      <li>
                        Cisco Security macros save to{" "}
                        <code>CiscoSecurityCloud/local/macros.conf</code>.
                      </li>
                      <li>
                        ThousandEyes macros save to{" "}
                        <code>ta_cisco_thousandeyes/local/macros.conf</code>.
                      </li>
                    </ul>
                  </InfoCard>
                  <div className="flex flex-wrap gap-2">
                    <GuideLink href={scdMacrosUrl}>
                      <Settings size={15} />
                      SCD Macros
                    </GuideLink>
                    <GuideLink href={cimMacrosUrl}>
                      <Settings size={15} />
                      CIM Macros
                    </GuideLink>
                  </div>
                </div>
              </div>
              <div className="mt-5 overflow-x-auto">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2 font-bold">Owner App</th>
                      <th className="px-3 py-2 font-bold">Definition Format</th>
                      <th className="px-3 py-2 font-bold">Examples</th>
                      <th className="px-3 py-2 font-bold">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {macroFamilies.map((row) => (
                      <tr
                        key={row.app}
                        className="border-b border-slate-100 align-top"
                      >
                        <td className="px-3 py-3 font-mono text-xs text-sky-800">
                          {row.app}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-slate-700">
                          {row.format}
                        </td>
                        <td className="px-3 py-3 text-slate-700">
                          {row.examples}
                        </td>
                        <td className="px-3 py-3 text-slate-600">{row.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section
              id="data-sources"
              title="Data Sources and Macro Families"
              kicker="The app expects normalized sourcetypes from Cisco add-ons, Splunk CIM, and supporting platform data."
              icon={<Database size={19} />}
            >
              <div className="overflow-x-auto">
                <table className="min-w-[980px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <th className="w-[24%] px-3 py-2 font-bold">Area</th>
                      <th className="w-[48%] px-3 py-2 font-bold">
                        Sourcetypes or Inputs
                      </th>
                      <th className="w-[28%] px-3 py-2 font-bold">Macro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataSources.map(([area, sourcetypes, macro]) => (
                      <tr
                        key={area}
                        className="border-b border-slate-100 align-top"
                      >
                        <td className="px-3 py-3 font-bold text-slate-800">
                          {area}
                        </td>
                        <td className="px-3 py-3 text-slate-700">
                          {sourcetypes}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-sky-800">
                          {macro}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-5 border border-slate-200 bg-slate-50 p-4">
                <h3 className="m-0 text-sm font-bold uppercase tracking-wide text-slate-600">
                  Supporting Macros
                </h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-[720px] border-collapse text-left text-sm">
                    <tbody>
                      {supportMacros.map(([macro, purpose]) => (
                        <tr
                          key={macro}
                          className="border-b border-slate-200 align-top last:border-b-0"
                        >
                          <td className="w-[30%] px-3 py-3 font-mono text-xs text-sky-800">
                            {macro}
                          </td>
                          <td className="px-3 py-3 text-slate-700">
                            {purpose}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Section>

            <Section
              id="dashboards"
              title="Dashboard Map"
              kicker="Use the guide as a quick route into the app's major views."
              icon={<MapIcon size={19} />}
            >
              <div className="grid gap-3 md:grid-cols-2">
                {dashboards.map((dashboard) => (
                  <a
                    key={dashboard.view}
                    href={appUrl(dashboard.view)}
                    className="group border border-slate-200 bg-slate-50 p-4 text-slate-800 transition hover:border-sky-300 hover:bg-sky-50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="m-0 text-base font-bold text-slate-950 group-hover:text-sky-800">
                        {dashboard.title}
                      </h3>
                      <ExternalLink
                        size={15}
                        className="shrink-0 text-slate-400 group-hover:text-sky-700"
                      />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {dashboard.summary}
                    </p>
                    <div className="mt-3 font-mono text-xs text-sky-800">
                      {dashboard.view}
                    </div>
                  </a>
                ))}
              </div>
            </Section>

            <Section
              id="workspaces"
              title="Insights Workspaces"
              kicker="Create reusable, customer-ready views without changing the built-in Secure Networking workspace."
              icon={<Layers size={19} />}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <InfoCard title="Workspace-owned configuration">
                  A workspace stores its own section layout, selected tiles,
                  signal rail, map visibility and placement, map presentation,
                  and light, dark, or system theme. Shared Signal Rail defaults
                  are centrally governed, while each signed-in user&apos;s rail
                  differences are private to that user and workspace and follow
                  the account across browsers. When adding a search, choose
                  <strong> For me</strong> for a browser-local tile or
                  <strong> Shared workspace</strong> to show it to every viewer;
                  the shared choice is available only to workspace managers.
                </InfoCard>
                <InfoCard title="Start with a template, then make it yours">
                  Templates are only a starting point for a new workspace.
                  After creation, edit the workspace directly: add or remove
                  sections, choose the tiles shown in each section, and tune
                  the visible tile count for the audience.
                </InfoCard>
                <InfoCard title="Use the right catalogue">
                  The workspace source determines the safe tile catalogue. App
                  labels are shown in the picker for readability; hover a label
                  to see the Splunk app directory name when you need it.
                </InfoCard>
                <InfoCard title="Present the same data differently">
                  Use executive workspaces for a concise briefing and a deeper
                  operational workspace for troubleshooting. The map can sit
                  beside, above, or below the tile grid, or be hidden when it
                  is not useful to the audience.
                </InfoCard>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <GuideLink href={workspaceUrl}>
                  <Layers size={15} />
                  Open Insights Workspaces
                </GuideLink>
                <GuideLink href={secureNetworkingUrl}>
                  <Gauge size={15} />
                  Open Secure Networking
                </GuideLink>
              </div>
            </Section>

            <Section
              id="site-connectivity"
              title="Customer Site Connectivity"
              kicker="Use the topology editor to connect business sites to ThousandEyes agent-to-agent measurements."
              icon={<MapIcon size={19} />}
            >
              <div className="grid gap-4 md:grid-cols-3">
                <InfoCard title="Discover site names">
                  The editor queries ThousandEyes agent-to-agent metric events
                  and offers the observed agent locations and names as site
                  inputs. Start from the sites Splunk already sees instead of
                  manually typing a fragile search filter.
                </InfoCard>
                <InfoCard title="Bind an A2A test">
                  Select the source and target sites, then choose a discovered
                  agent-to-agent test. The saved binding drives inter-site
                  latency, loss, and jitter with the matching test identity.
                </InfoCard>
                <InfoCard title="Investigate in ThousandEyes">
                  A bound test retains the ThousandEyes permalink when it is
                  present, or builds a link from the test and account IDs. Use
                  it to open the same test in ThousandEyes for path-level
                  investigation.
                </InfoCard>
              </div>
              <div className="mt-4 border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                <strong>When no test is available:</strong> create an
                agent-to-agent test between the two enterprise agents in
                ThousandEyes, allow metric events to arrive in Splunk, then
                reopen the topology editor and select the discovered test.
              </div>
              <div className="mt-4">
                <GuideLink href={secureNetworkingUrl}>
                  <MapIcon size={15} />
                  Open Site Connectivity Map
                </GuideLink>
              </div>
            </Section>

            <Section
              id="lookups"
              title="Lookups, Searchbase, and Saved Searches"
              kicker="A few support assets are part of normal operation."
              icon={<Layers size={19} />}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <InfoCard title="searchbase.conf">
                  Search definitions live in{" "}
                  <code>default/searchbase.conf</code> as the catalogue for
                  dashboard SPL, admin references, and helper tooling. React
                  utilities can read this catalogue when a page needs to expose
                  or run a named search. Each entry can retain its source app
                  classification while opening locally in Splunk App for Secure
                  Networking.
                </InfoCard>
                <InfoCard title="Searchbase Canvas">
                  Use the canvas to assemble a working view from catalogue
                  searches. Filter tiles by app, working state, needs attention,
                  or failed searches; the app filter adapts its counts to the
                  other active filters.
                </InfoCard>
                <InfoCard title="site_topology_lookup">
                  The scheduled Site Topology Lookup Generator snapshots
                  Catalyst Center site topology into{" "}
                  <code>site_topology_lookup.csv</code> so client and device
                  panels can turn site IDs into readable site names.
                </InfoCard>
                <InfoCard title="scd_summariesonly">
                  This macro controls tstats acceleration behavior for searches
                  that can use summaries. Tune it deliberately for your
                  environment.
                </InfoCard>
                <InfoCard title="Dashboard Studio and React">
                  Most operational dashboards are Dashboard Studio XML. Utility
                  pages such as Macro Index Tuning and this guide are React
                  bundles mounted inside Simple XML shells.
                </InfoCard>
              </div>
            </Section>

            <Section
              id="operations"
              title="Operating Practices"
              kicker="A small amount of routine care prevents most dashboard issues."
              icon={<Activity size={19} />}
            >
              <div className="grid gap-4 md:grid-cols-3">
                <InfoCard title="After index changes">
                  Rerun Macro Index Tuning and save updated macros before
                  troubleshooting individual panels.
                </InfoCard>
                <InfoCard title="After add-on changes">
                  Recheck sourcetype names and field extraction. The dashboards
                  expect normalized Cisco and CIM fields.
                </InfoCard>
                <InfoCard title="After app upgrades">
                  Compare local macro overrides with new defaults, then refresh
                  Splunk Web so updated JavaScript bundles and dashboard
                  definitions load.
                </InfoCard>
              </div>
            </Section>

            <Section
              id="troubleshooting"
              title="Troubleshooting"
              kicker="Start broad, then narrow to macro, sourcetype, field, and lookup issues."
              icon={<AlertTriangle size={19} />}
            >
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2 font-bold">Symptom</th>
                      <th className="px-3 py-2 font-bold">First Check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {troubleshootingRows.map(([symptom, check]) => (
                      <tr key={symptom} className="border-b border-slate-100">
                        <td className="px-3 py-3 font-bold text-slate-800">
                          {symptom}
                        </td>
                        <td className="px-3 py-3 text-slate-700">{check}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <GuideLink
                  href={searchUrl(
                    "| tstats count where index=* by index sourcetype | sort -count",
                  )}
                >
                  <FileSearch size={15} />
                  Data Inventory
                </GuideLink>
                <GuideLink
                  href={searchUrl(
                    "| inputlookup site_topology_lookup | stats count by type",
                  )}
                >
                  <GitBranch size={15} />
                  Site Lookup Check
                </GuideLink>
                <GuideLink href={appUrl("searchbase_canvas")}>
                  <CheckCircle2 size={15} />
                  Searchbase Canvas
                </GuideLink>
              </div>
            </Section>

            <Section
              id="release-notes"
              title="What’s New and Release Notes"
              kicker="A concise record of user-visible changes included with this version of the app."
              icon={<CheckCircle2 size={19} />}
            >
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2 font-bold">Version</th>
                      <th className="px-3 py-2 font-bold">Release focus</th>
                      <th className="px-3 py-2 font-bold">Administrator action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100 align-top">
                      <td className="px-3 py-3 font-mono text-xs font-bold text-sky-800">
                        {APP_VERSION_LABEL}
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        Secure Networking dashboard clarity, guided setup,
                        workspace customization, Searchbase navigation, and
                        site-connectivity improvements.
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        Review setup readiness after installing companion apps;
                        existing workspaces keep their saved configuration.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <InfoCard title="Secure Networking dashboards">
                  All 16 Secure Networking Dashboard Studio views now use a
                  Cisco-inspired dark-mode hierarchy with purpose-led headers,
                  compact audience and source context, decision-oriented
                  section guidance, and visible Searchbase-derived
                  descriptions on all 131 data panels. Existing searches,
                  tokens, drilldowns, and data-source references are preserved.
                  The five pillar dashboards share the Insights Workspace dark
                  palette, including slate surfaces and text, sky accents, and
                  the same semantic status colors used by the home dashboard.
                  Panel rows are now compact, and Dashboard Manager view mode
                  provides Studio-style Display, zoom, JSON export, and clone
                  controls without giving up Searchbase-backed rendering.
                  The 13 single-value KPIs across Executive Overview, Threat
                  Detection and Enforcement, Authentication and Policy
                  Enforcement, and Secure Infrastructure Status now include
                  time-bucketed sparklines and percent trends. SD-WAN site
                  mapping, the Segmentation binding pie, and ISE RADIUS latency
                  formatting are also corrected for their live result shapes.
                </InfoCard>
                <InfoCard title="Guided setup and performance readiness">
                  Setup now brings package checks, index macro discovery, data
                  model acceleration readiness, targeted Data Models links, and
                  the readiness query&apos;s Open in Search path into one flow.
                  It writes companion-app macros only when that app is enabled
                  and installed. Balanced mode remains available while
                  recommended acceleration is completed.
                </InfoCard>
                <InfoCard title="Insights Workspaces">
                  Workspaces now own their layout and presentation choices,
                  including sections, tiles, signal rail, map configuration,
                  and theme. Signal Rail defaults are centrally managed, with
                  private account-and-workspace overrides for each signed-in
                  user. Headers prioritize the workspace title with compact
                  range and refresh controls, responsive health status, and
                  clear globe and layers iconography without duplicating
                  Splunk Web&apos;s account control. Signal Rails default to
                  comfortable density, offer small, standard, and large KPI
                  text, and use the full width without a fixed label block.
                  Tile drag and remove controls appear only from the top-left
                  action corner. A template helps create the initial workspace
                  but does not constrain future customization.
                </InfoCard>
                <InfoCard title="Dashboard Studio editing">
                  Dashboard Manager confirmation dialogs now use the edited
                  dashboard&apos;s saved light or dark theme, even when it differs
                  from the signed-in user&apos;s Splunk appearance preference.
                </InfoCard>
                <InfoCard title="Searchbase and tile selection">
                  Searchbase Canvas distinguishes failed searches from other
                  attention states and adds app filtering. Catalogue and tile
                  pickers display friendly app labels with the on-disk name
                  available as hover detail.
                </InfoCard>
                <InfoCard title="Contextual empty results">
                  Searchbase-backed Secure Networking panels now explain when no
                  matching telemetry exists in the selected time range, including
                  when the monitored condition may simply not have occurred. The
                  searches used by every Secure Networking Studio dashboard also
                  emit visualization-compatible fallback rows, so the guidance is
                  preserved outside Dashboard Manager.
                </InfoCard>
                <InfoCard title="Site connectivity">
                  The topology workflow can discover ThousandEyes agent-to-agent
                  site inputs, bind a selected test, and link operators to the
                  corresponding ThousandEyes test for deeper investigation.
                </InfoCard>
              </div>
              <p className="mt-5 text-sm leading-6 text-slate-600">
                This in-app section is the release-notes source for the current
                version. For upgrades, use the setup workflow after installation
                to confirm companion-package and data-model readiness before
                publishing a workspace to users.
              </p>
            </Section>

            <div className="grid gap-4 md:grid-cols-4">
              <InfoCard title="Network">
                <Wifi size={18} className="mb-2 text-sky-700" />
                Catalyst, SD-WAN, Zeek, Meraki, NVM, F5, and data center views.
              </InfoCard>
              <InfoCard title="Security">
                <Shield size={18} className="mb-2 text-red-600" />
                Firewall, identity, endpoint, DNS, web, email, and incident
                views.
              </InfoCard>
              <InfoCard title="Experience">
                <Gauge size={18} className="mb-2 text-emerald-700" />
                Client health, ThousandEyes, site readiness, and activation
                reporting.
              </InfoCard>
              <InfoCard title="Setup">
                <Settings size={18} className="mb-2 text-slate-700" />
                Macro tuning, lookup health, and searchbase reference tooling.
              </InfoCard>
            </div>
          </div>
        </article>
        <GuidePageToc
          activeHeading={activeHeading}
          activeSection={activeSection}
          entries={pageTocBySection.get(activeSection) || []}
          goToHeading={goToHeading}
        />
      </div>
    </main>
  );
}
