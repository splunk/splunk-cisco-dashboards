/* eslint-disable react/jsx-filename-extension */
import React, { useCallback, useEffect, useRef, useState } from "react";
import Button from "@splunk/react-ui/Button";
import Code from "@splunk/react-ui/Code";
import Dropdown from "@splunk/react-ui/Dropdown";
import Menu from "@splunk/react-ui/Menu";
import Typography from "@splunk/react-ui/Typography";
import { variables } from "@splunk/themes";
import styled from "styled-components";
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
    Moon,
    PlayCircle,
    Search,
    Settings,
    Shield,
    SlidersHorizontal,
    Sun,
    Wifi,
} from '@/common/icons/SuiIcon';
import AppearanceMenuItems from "@/common/components/AppearanceMenuItems";
import { APP_VERSION_LABEL } from "@/common/lib/buildInfo";
import { useAppThemeControls } from "@/common/theme/AppThemeProvider";

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

const sectionLinkBase = "scd-guide-action-link";

function InlineCodeTypography({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <Typography as="code" className={className} color="active" variant="monoBody">
      {children}
    </Typography>
  );
}

const InlineCodeText = styled(InlineCodeTypography)`
  background: ${variables.backgroundColorPage};
  border: 1px solid ${variables.borderColorWeak};
  border-radius: ${variables.borderRadius};
  box-decoration-break: clone;
  overflow-wrap: anywhere;
  padding: 1px ${variables.spacingXSmall};
  white-space: break-spaces;
`;

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

function InlineCode({ children }: { children: React.ReactNode }): JSX.Element {
  return <InlineCodeText>{children}</InlineCodeText>;
}

function FormattedCodeText({ value }: { value: string }): JSX.Element {
  const parts = value.split("`");
  let isCode = false;
  let offset = 0;
  return (
    <>
      {parts.map((part) => {
        const key = `${offset}-${part}`;
        const content = isCode ? (
          <InlineCode key={key}>{part}</InlineCode>
        ) : (
          part
        );
        offset += part.length + 1;
        isCode = !isCode;
        return content;
      })}
    </>
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
    <section id={id} data-guide-section={id} className="scd-guide-section">
      <div className="scd-guide-section-header">
        <div className="scd-guide-section-heading-row">
          <div className="scd-guide-section-icon" aria-hidden="true">
            {icon}
          </div>
          <div className="scd-guide-section-heading-copy">
            <div className="scd-guide-section-number">
              Section {sectionNumber(id)}
            </div>
            <h2>{title}</h2>
            {kicker && <p>{kicker}</p>}
          </div>
        </div>
      </div>
      <div className="scd-guide-section-body">{children}</div>
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
    <section className="scd-guide-info-block">
      <h3>{title}</h3>
      <div>{children}</div>
    </section>
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
    <div className="scd-guide-code-block">
      <div className="scd-guide-code-toolbar scd-guide-no-print">
        <span>Configuration example</span>
        <Button
          appearance="subtle"
          icon={copied ? <Check size={13} /> : <Copy size={13} />}
          label={copied ? "Copied" : "Copy"}
          onClick={copyCode}
        />
      </div>
      <Code
        containerAppearance="section"
        language="text"
        lineWrap
        showIndentGuide={false}
        value={code}
      />
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
                  <a
                    href={`#${section.id}`}
                    aria-current={active ? "location" : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      goToSection(section.id);
                    }}
                    className="scd-guide-toc-link"
                  >
                    <span className="scd-guide-toc-chip">{number}</span>
                    <span className="scd-guide-toc-text">{section.label}</span>
                  </a>
                </li>
              );
            })}
          </React.Fragment>
        ))}
      </ol>

      <div className="scd-guide-toc-footer">
        <a
          href={`${appUrl("setup")}?setup=1#tune-indexes`}
          className="scd-guide-toc-quicklink"
        >
          Setup: Tune indexes →
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
            <a
              href={`#${entry.id}`}
              className="scd-guide-page-toc-link"
              onClick={(event) => {
                event.preventDefault();
                goToHeading(entry.id);
              }}
            >
              {entry.label}
            </a>
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
    view: "workspace_insights?workspace=secure_networking",
    summary:
      "Executive landing page with health KPIs, workspace-aware signal rail, topology, and summary tiles.",
  },
  {
    title: "Insights Workspaces",
    view: "workspace_insights",
    summary:
      "Reusable executive views that keep their own sections, tile choices, map placement, and theme.",
  },
  {
    title: "IT Health",
    view: "dashboard_manager#/netops_critical_systems_health",
    summary:
      "Catalyst Center, ISE, ThousandEyes, device health, identity, and user experience.",
  },
  {
    title: "Security",
    view: "dashboard_manager#/secops_resilience",
    summary:
      "Firewall, IPS, DNS, email, web, identity, endpoint, and security event visibility.",
  },
  {
    title: "Building Intelligence",
    view: "dashboard_manager#/workplace_building_intelligence",
    summary:
      "Cisco Spaces, occupancy, building telemetry, wireless trust, and location intelligence.",
  },
  {
    title: "Cisco Spaces Intelligence",
    view: "dashboard_manager#/workplace_spaces_intelligence",
    summary:
      "Environmental, capacity, room, operations, visitor, and network impact analytics.",
  },
  {
    title: "Network Operations Report",
    view: "dashboard_manager#/netops_catalyst_health",
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
    name: "Cisco Enterprise Networking App for Splunk",
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
    "Deprecated compatibility macro for external/custom dashboards; Insights Workspace titles now come from workspace configuration and the branding editor.",
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
    "Open Setup, run Tune indexes, verify the time range, then open the panel in Search.",
  ],
  [
    "Searches are slow",
    "Tighten macros away from index=*, keep CIM discovery ranges short, and check tstats acceleration.",
  ],
  [
    "CIM panels are blank",
    "Open optional CIM tuning, use a short range, and save the detected macros into Splunk_SA_CIM/local/macros.conf.",
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
  const { canChooseColorScheme, colorScheme } = useAppThemeControls();
  const setupUrl = `${appUrl("setup")}?setup=1`;
  const setupTuningUrl = `${setupUrl}#tune-indexes`;
  const setupCimTuningUrl = `${setupUrl}#tune-cim`;
  const workspaceUrl = appUrl("workspace_insights");
  const secureNetworkingUrl = `${appUrl("workspace_insights")}?workspace=secure_networking`;
  const scdMacrosUrl = managerUrl(APP_NAME, "data/macros");
  const cimMacrosUrl = managerUrl("Splunk_SA_CIM", "data/macros");
  const guideContentRef = useRef<HTMLDivElement | null>(null);
  const matchesRef = useRef<HTMLElement[]>([]);
  const currentSearchIndexRef = useRef(-1);
  const appearanceToggleRef = useRef<
    HTMLAnchorElement | HTMLButtonElement
  >(null);
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
  const [appearanceMenuOpen, setAppearanceMenuOpen] = useState(false);

  const closeAppearanceMenu = useCallback(() => {
    setAppearanceMenuOpen(false);
    window.setTimeout(() => appearanceToggleRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("scd-overview-active");
    document.body.classList.add("scd-overview-active");
    return () => {
      document.documentElement.classList.remove("scd-overview-active");
      document.body.classList.remove("scd-overview-active");
    };
  }, []);

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
        const reduceMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        match.scrollIntoView({
          behavior: reduceMotion ? "auto" : "smooth",
          block: "center",
        });
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
    section.tabIndex = -1;
    section.focus({ preventScroll: true });
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
    target.tabIndex = -1;
    target.focus({ preventScroll: true });
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
    document.title = `Splunk Secure Networking Essentials User Guide ${APP_VERSION_LABEL}`;
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
    <main
      className={`scd-user-guide scd-overview-page scd-c3-surface min-h-screen${
        colorScheme === "dark" ? " scd-c3-atmosphere" : ""
      }`}
      data-color-scheme={colorScheme}
      style={{ colorScheme }}
    >
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

        <article className="scd-guide-document">
          <header className="scd-guide-hero">
            <div className="scd-guide-hero-heading-row">
              <div className="scd-guide-hero-heading-copy">
                <div className="scd-guide-hero-eyebrow">
                  <LifeBuoy size={15} />
                  User Guide
                </div>
                <h1>
                  Splunk Secure Networking Essentials
                </h1>
              </div>
              <div className="scd-guide-hero-actions scd-guide-no-print">
                {canChooseColorScheme ? (
                  <Dropdown
                    defaultPlacement="below"
                    focusToggleReasons={["escapeKey", "tabKey", "toggleClick"]}
                    open={appearanceMenuOpen}
                    onRequestClose={() => setAppearanceMenuOpen(false)}
                    onRequestOpen={() => setAppearanceMenuOpen(true)}
                    toggle={
                      <Button
                        appearance="secondary"
                        elementRef={appearanceToggleRef}
                        icon={
                          colorScheme === "light" ? (
                            <Sun aria-hidden="true" size={17} />
                          ) : (
                            <Moon aria-hidden="true" size={17} />
                          )
                        }
                        label="Appearance"
                      />
                    }
                  >
                    <Menu>
                      <AppearanceMenuItems onSelect={closeAppearanceMenu} />
                    </Menu>
                  </Dropdown>
                ) : null}
                <Button
                  appearance="secondary"
                  icon={<Download size={17} />}
                  label="Export PDF"
                  onClick={exportPdf}
                />
              </div>
            </div>

            <p className="scd-guide-hero-summary">
              Setup and operating guide for deploying the app, tuning macros,
              validating data sources, and keeping the executive dashboards
              useful after the first install.
            </p>
            <div className="scd-guide-hero-metadata">
              <span>
                <strong>Version:</strong> {APP_VERSION_LABEL}
              </span>
              <span>
                <strong>License:</strong> Apache-2.0
              </span>
            </div>
            <div className="scd-guide-hero-links scd-guide-no-print">
              <GuideLink href={setupTuningUrl}>
                <SlidersHorizontal size={15} />
                Setup: Tune indexes
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

          <div ref={guideContentRef} className="scd-guide-content">
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
              <div className="scd-guide-table-wrap">
                <table className="min-w-[1180px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b sui-border-weak sui-bg-page text-xs uppercase tracking-wide sui-color-muted">
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
                        className="border-b sui-border-weak align-top"
                      >
                        <td className="px-3 py-3 font-bold sui-color-active">
                          {app.name}
                        </td>
                        <td className="px-3 py-3 sui-color-default">
                          <InlineCode>{app.folder}</InlineCode>
                        </td>
                        <td className="px-3 py-3">
                          <a
                            href={app.splunkbase}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="scd-guide-table-link"
                          >
                            {app.splunkbase}
                            <ExternalLink size={13} />
                          </a>
                        </td>
                        <td className="px-3 py-3 sui-color-default">
                          <InlineCode>{app.models}</InlineCode>
                        </td>
                        <td className="px-3 py-3 sui-color-default">
                          {app.usage}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-sm leading-6 sui-color-default">
                Splunk Secure Networking Essentials currently uses the Cisco
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
              <ol className="m-0 grid gap-3 pl-5 text-sm leading-6 sui-color-default">
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
                <GuideLink href={setupTuningUrl}>
                  <SlidersHorizontal size={15} />
                  Open Tune indexes
                </GuideLink>
                <GuideLink href={setupCimTuningUrl}>
                  <Database size={15} />
                  Optional CIM tuning
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
              title="Setup: Tune Indexes"
              kicker="The most important setup step. It maps your real indexes to the macros the dashboards and data models use."
              icon={<SlidersHorizontal size={19} />}
            >
              <div className="scd-guide-prose">
                <p className="m-0">
                  <strong>Tune indexes</strong> is the third and final step of
                  the Setup workflow. Its React interface is loaded directly
                  inside Setup; the standalone{" "}
                  <InlineCode>admin_macro_index_tuning.xml</InlineCode> route
                  redirects here so administrators have one setup destination.
                  The fast scan uses the{" "}
                  <InlineCode>admin_macro_index_tuning</InlineCode> Searchbase
                  entry, which performs a tstats pass over known Cisco
                  sourcetypes and generates macro definitions. The UI discovers
                  every SCD macro whose name starts with{" "}
                  <InlineCode>index_</InlineCode> from this app at runtime, so
                  newly added index macros appear in the scan without updating
                  a hardcoded list. It also centralizes companion macro tuning,
                  including Cisco Data Center Networking, Cisco Security Cloud,
                  and ThousandEyes definitions, so their dashboards are ready
                  when you open them.
                </p>
                <p className="m-0">
                  CIM discovery is intentionally separate because it uses
                  tag-based raw searches such as authentication and network
                  communication tags. Keep that range short unless you are
                  validating a new deployment.
                </p>
                <p className="m-0">
                  The readiness panel reports acceleration independently of
                  macro detection. Use its <strong>Open in Search</strong> link
                  to review the REST-backed check, or an individual
                  <strong> Accelerate data model</strong> link to open the
                  matching Data Models manager page.
                </p>
              </div>
              <div className="scd-guide-reference-grid">
                <CodeBlock>{`# SCD macro format
[index_catalyst]
definition = index IN (cisco_catcenter, dnac)
iseval = 0

# CIM and external app format
[cim_Network_Traffic_indexes]
definition = (index=net_firewall OR index=net_flow)
iseval = 0`}</CodeBlock>
                <div className="scd-guide-reference-column">
                  <InfoCard title="Where saves go">
                    <ul className="m-0 space-y-2 pl-4">
                      <li>
                        SCD macros save to{" "}
                        <InlineCode>
                          splunk-cisco-dashboards/local/macros.conf
                        </InlineCode>
                        .
                      </li>
                      <li>
                        CIM macros save to{" "}
                        <InlineCode>Splunk_SA_CIM/local/macros.conf</InlineCode>.
                      </li>
                      <li>
                        Cisco Security macros save to{" "}
                        <InlineCode>
                          CiscoSecurityCloud/local/macros.conf
                        </InlineCode>
                        .
                      </li>
                      <li>
                        ThousandEyes macros save to{" "}
                        <InlineCode>
                          ta_cisco_thousandeyes/local/macros.conf
                        </InlineCode>
                        .
                      </li>
                    </ul>
                  </InfoCard>
                  <div className="scd-guide-reference-links">
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
              <div className="scd-guide-table-wrap scd-guide-table-spacing">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b sui-border-weak sui-bg-page text-xs uppercase tracking-wide sui-color-muted">
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
                        className="border-b sui-border-weak align-top"
                      >
                        <td className="px-3 py-3 sui-color-default">
                          <InlineCode>{row.app}</InlineCode>
                        </td>
                        <td className="px-3 py-3 sui-color-default">
                          <InlineCode>{row.format}</InlineCode>
                        </td>
                        <td className="px-3 py-3 sui-color-default">
                          {row.examples}
                        </td>
                        <td className="px-3 py-3 sui-color-default">{row.note}</td>
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
              <div className="scd-guide-table-wrap">
                <table className="min-w-[980px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b sui-border-weak sui-bg-page text-xs uppercase tracking-wide sui-color-muted">
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
                        className="border-b sui-border-weak align-top"
                      >
                        <td className="px-3 py-3 font-bold sui-color-active">
                          {area}
                        </td>
                        <td className="px-3 py-3 sui-color-default">
                          <FormattedCodeText value={sourcetypes} />
                        </td>
                        <td className="px-3 py-3 sui-color-default">
                          <FormattedCodeText value={macro} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <section className="scd-guide-supporting-table">
                <h3>Supporting macros</h3>
                <div className="scd-guide-table-wrap">
                  <table className="min-w-[720px] border-collapse text-left text-sm">
                    <tbody>
                      {supportMacros.map(([macro, purpose]) => (
                        <tr
                          key={macro}
                          className="border-b sui-border-weak align-top last:border-b-0"
                        >
                          <td className="w-[30%] px-3 py-3 sui-color-default">
                            <FormattedCodeText value={macro} />
                          </td>
                          <td className="px-3 py-3 sui-color-default">
                            {purpose}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
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
                    className="scd-guide-dashboard-link"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="m-0 text-base font-bold sui-color-active sui-group-hover-color-info">
                        {dashboard.title}
                      </h3>
                      <ExternalLink
                        size={15}
                        className="shrink-0 sui-color-default sui-group-hover-color-info"
                      />
                    </div>
                    <p>{dashboard.summary}</p>
                    <div className="scd-guide-dashboard-route">
                      <InlineCode>{dashboard.view}</InlineCode>
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
                  A workspace stores its shared sections, tile membership and
                  order, map configuration, and Signal Rail defaults. When
                  adding a search, choose <strong> Add for me</strong> for a
                  private tile or <strong> Add for everyone</strong> to add it
                  to the shared workspace for every viewer; the shared choice
                  is available only to workspace managers. Browser preferences
                  are isolated by signed-in account, workspace, and browser.
                  Private Signal Rail preferences also follow the account across
                  browsers.
                </InfoCard>
                <InfoCard title="Role-based change control">
                  Workspace access has three levels: personal changes, shared
                  workspace changes, and factory tile changes. The app checks
                  the signed-in user&apos;s Splunk roles and capabilities before
                  it displays shared or administrative controls. Splunk object
                  permissions enforce the corresponding writes on the server.
                </InfoCard>
                <InfoCard title="Start with a template, then make it yours">
                  Templates are only a starting point for a new workspace.
                  After creation, edit the workspace directly: add or remove
                  sections, choose the tiles shown in each section, and tune
                  the visible tile count for the audience.
                </InfoCard>
                <InfoCard title="Use the right catalogue">
                  Suggested searches match the active workspace section and
                  hide searches that are already configured. Use Show added
                  searches when you need to review the current roster. Entire
                  catalogue expands the list to every addable search exposed by
                  installed Searchbase providers, where the App filter narrows
                  results by execution context. Cross-app additions retain their
                  owning app so identically named stanzas remain distinct.
                </InfoCard>
                <InfoCard title="Present the same data differently">
                  Use executive workspaces for a concise briefing and a deeper
                  operational workspace for troubleshooting. The map can sit
                  beside, above, or below the tile grid, or be hidden when it
                  is not useful to the audience. Sections start expanded and
                  can be collapsed to a KPI and health summary or focused to
                  use the available metrics pane. Compact H1 sparklines keep
                  the trend visible; focus restores full labels and chart
                  detail without changing the shared factory layout.
                </InfoCard>
              </div>
              <div className="mt-5">
                <h3
                  id="workspaces-workspace-permissions-by-role-and-capability"
                  className="m-0 text-base font-bold sui-color-active"
                >
                  Workspace permissions by role and capability
                </h3>
                <p className="mt-2 text-sm leading-6 sui-color-default">
                  The following table describes the effective access for the
                  role names and capability that the app recognizes:
                </p>
                <div className="scd-guide-table-wrap scd-guide-table-inner-spacing">
                  <table
                    aria-labelledby="workspaces-workspace-permissions-by-role-and-capability"
                    className="min-w-[1120px] border-collapse text-left text-sm"
                  >
                    <thead>
                      <tr className="border-b sui-border-weak sui-bg-page text-xs uppercase tracking-wide sui-color-muted">
                        <th
                          scope="col"
                          className="w-[30%] px-3 py-2 font-bold"
                        >
                          Action
                        </th>
                        <th
                          scope="col"
                          className="w-[14%] px-3 py-2 font-bold"
                        >
                          user or other role
                        </th>
                        <th
                          scope="col"
                          className="w-[14%] px-3 py-2 font-bold"
                        >
                          power
                        </th>
                        <th
                          scope="col"
                          className="w-[14%] px-3 py-2 font-bold"
                        >
                          delegated capability
                        </th>
                        <th
                          scope="col"
                          className="w-[14%] px-3 py-2 font-bold"
                        >
                          admin or sc_admin
                        </th>
                        <th
                          scope="col"
                          className="w-[14%] px-3 py-2 font-bold"
                        >
                          admin_all_objects
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b sui-border-weak align-top">
                        <td className="px-3 py-3 sui-color-default">
                          Open workspaces, run permitted searches, and drill
                          into permitted results
                        </td>
                        <td className="px-3 py-3 sui-color-default">Allowed</td>
                        <td className="px-3 py-3 sui-color-default">Allowed</td>
                        <td className="px-3 py-3 sui-color-default">Allowed</td>
                        <td className="px-3 py-3 sui-color-default">Allowed</td>
                        <td className="px-3 py-3 sui-color-default">Allowed</td>
                      </tr>
                      <tr className="border-b sui-border-weak align-top">
                        <td className="px-3 py-3 sui-color-default">
                          Personalize layout, tile order and visibility, chart
                          display, branding, private searches, and Signal Rail
                          preferences
                        </td>
                        <td className="px-3 py-3 sui-color-default">Allowed</td>
                        <td className="px-3 py-3 sui-color-default">Allowed</td>
                        <td className="px-3 py-3 sui-color-default">Allowed</td>
                        <td className="px-3 py-3 sui-color-default">Allowed</td>
                        <td className="px-3 py-3 sui-color-default">Allowed</td>
                      </tr>
                      <tr className="border-b sui-border-weak align-top">
                        <td className="px-3 py-3 sui-color-default">
                          Create, edit, or duplicate shared workspaces; publish
                          shared layouts, section titles, and default tiles
                        </td>
                        <td className="px-3 py-3 sui-color-default">
                          Not allowed
                        </td>
                        <td className="px-3 py-3 sui-color-default">Allowed</td>
                        <td className="px-3 py-3 sui-color-default">Allowed</td>
                        <td className="px-3 py-3 sui-color-default">Allowed</td>
                        <td className="px-3 py-3 sui-color-default">Allowed</td>
                      </tr>
                      <tr className="border-b sui-border-weak align-top">
                        <td className="px-3 py-3 sui-color-default">
                          Edit the shared customer topology
                        </td>
                        <td className="px-3 py-3 sui-color-default">
                          Not allowed
                        </td>
                        <td className="px-3 py-3 sui-color-default">Allowed</td>
                        <td className="px-3 py-3 sui-color-default">Allowed</td>
                        <td className="px-3 py-3 sui-color-default">Allowed</td>
                        <td className="px-3 py-3 sui-color-default">Allowed</td>
                      </tr>
                      <tr className="border-b sui-border-weak align-top">
                        <td className="px-3 py-3 sui-color-default">
                          Replace a factory tile&apos;s Searchbase or change its
                          shared thresholds, data mapping, and drilldown
                        </td>
                        <td className="px-3 py-3 sui-color-default">
                          Not allowed
                        </td>
                        <td className="px-3 py-3 sui-color-default">
                          Not allowed
                        </td>
                        <td className="px-3 py-3 sui-color-default">
                          Not allowed
                        </td>
                        <td className="px-3 py-3 sui-color-default">Allowed</td>
                        <td className="px-3 py-3 sui-color-default">Allowed</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <InfoCard title="How the capability check works">
                  When the workspace opens, the app reads the current Splunk
                  user context. An exact <InlineCode>power</InlineCode>,{" "}
                  <InlineCode>admin</InlineCode>, or{" "}
                  <InlineCode>sc_admin</InlineCode> role grants shared workspace
                  and topology management. An exact{" "}
                  <InlineCode>admin</InlineCode> or{" "}
                  <InlineCode>sc_admin</InlineCode> role grants factory tile
                  management. The{" "}
                  <InlineCode>scd_manage_insights_workspaces</InlineCode>{" "}
                  capability grants shared workspace and topology management
                  without granting factory tile management. The{" "}
                  <InlineCode>admin_all_objects</InlineCode> capability grants both levels
                  regardless of the role name. If the user context cannot be
                  read, the app denies shared and factory changes.
                </InfoCard>
                <InfoCard title="Custom roles and data access">
                  Assign <InlineCode>scd_manage_insights_workspaces</InlineCode>{" "}
                  to a custom role when its members should create, edit,
                  duplicate, or delete shared workspaces and edit the shared
                  topology. The app&apos;s capability-protected REST handlers
                  enforce those mutations on the server. No separate
                  capability setup is required for the built-in{" "}
                  <InlineCode>power</InlineCode>, <InlineCode>admin</InlineCode>,
                  or <InlineCode>sc_admin</InlineCode> roles because the app
                  grants it to those roles. Because{" "}
                  <InlineCode>admin_all_objects</InlineCode> grants broad Splunk
                  Enterprise access, do not assign it only to enable workspace
                  editing. The narrower capability does not permit factory
                  <InlineCode>searchbase.conf</InlineCode> changes. App access,
                  the <InlineCode>search</InlineCode>{" "}
                  capability, index permissions, and
                  knowledge object permissions continue to control which data
                  each user can view.
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
              <div className="scd-guide-note">
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
                  <InlineCode>default/searchbase.conf</InlineCode> as the catalogue for
                  dashboard SPL, admin references, and helper tooling. React
                  utilities can read this catalogue when a page needs to expose
                  or run a named search. Each entry can retain its source app
                  classification while opening locally in Splunk Secure
                  Networking Essentials.
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
                  <InlineCode>site_topology_lookup.csv</InlineCode> so client and device
                  panels can turn site IDs into readable site names.
                </InfoCard>
                <InfoCard title="scd_summariesonly">
                  This macro controls tstats acceleration behavior for searches
                  that can use summaries. Tune it deliberately for your
                  environment.
                </InfoCard>
                <InfoCard title="Dashboard Studio and React">
                  Most operational dashboards are Dashboard Studio XML. Utility
                  experiences such as Setup&apos;s Tune indexes step and this guide
                  use React bundles mounted inside Simple XML shells.
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
                  Open Setup, rerun Tune indexes, and save updated macros before
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
              <div className="scd-guide-table-wrap">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b sui-border-weak sui-bg-page text-xs uppercase tracking-wide sui-color-muted">
                      <th className="px-3 py-2 font-bold">Symptom</th>
                      <th className="px-3 py-2 font-bold">First Check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {troubleshootingRows.map(([symptom, check]) => (
                      <tr key={symptom} className="border-b sui-border-weak">
                        <td className="px-3 py-3 font-bold sui-color-active">
                          {symptom}
                        </td>
                        <td className="px-3 py-3 sui-color-default">{check}</td>
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
              <div className="scd-guide-table-wrap">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b sui-border-weak sui-bg-page text-xs uppercase tracking-wide sui-color-muted">
                      <th className="px-3 py-2 font-bold">Version</th>
                      <th className="px-3 py-2 font-bold">Release focus</th>
                      <th className="px-3 py-2 font-bold">Administrator action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b sui-border-weak align-top">
                      <td className="px-3 py-3 sui-color-default">
                        <InlineCode>{APP_VERSION_LABEL}</InlineCode>
                      </td>
                      <td className="px-3 py-3 sui-color-default">
                        Agentic SOC live-conference visibility, six-card Secure
                        Networking KPI stories, guided setup, workspace
                        customization, Searchbase drilldowns, and
                        site-connectivity improvements. IOS-XR anomaly searches
                        are now self-contained, Open in Search accepts only
                        dashboard-defined safe filter values, and shared
                        workspace and bounded Dashboard Builder background
                        management support narrow capability delegation. Cisco
                        Spaces floor-plan images use the same safe shared-image
                        boundary, so configured map artwork cannot fetch
                        arbitrary network or local URLs from a viewer browser.
                        Topology palette items and key manager/KPI
                        dialogs now support complete keyboard operation. Release
                        metadata now follows the canonical app version,
                        upgrade notifications are explicit, and React Router
                        is on its supported security-maintenance line. Dashboard
                        Manager now makes Edit visible from library cards and
                        previews, while its Searchbase picker starts with compact
                        search-name rows and can reveal full metadata on demand.
                        New dashboards default to Shared in App, with Private
                        retained as an explicit creation-time choice.
                      </td>
                      <td className="px-3 py-3 sui-color-default">
                        Install the build through the supported app-management
                        workflow; no customer-managed Splunk restart is
                        required. Fresh local <InlineCode>build.sh --install</InlineCode>{" "}
                        and <InlineCode>--deploy</InlineCode> builds default to
                        developer-profile archives so iterative installs do not
                        collide with immutable SplunkBase release identities;
                        pass <InlineCode>--splunkbase</InlineCode> when validating
                        the released-resources-only profile. Release archives
                        use one validated packaging path and preserve live
                        development-local configuration. Existing workspaces keep their saved
                        configuration; assign{" "}
                        <InlineCode>scd_manage_insights_workspaces</InlineCode>{" "}
                        only to custom roles that should manage shared
                        workspaces, topology, and shared Dashboard Builder
                        backgrounds.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <InfoCard title="Agentic Security Operations Center">
                  A built-in conference workspace now organizes live Cisco
                  Umbrella DNS, Secure Firewall, and Endace/Zeek telemetry into
                  three focused sections. DNS Security covers unique domains,
                  request and block trends, categories, and applications.
                  Firewall Threat Defense covers intrusion detections, Security
                  Intelligence matches, and destination countries. Network
                  Detection &amp; Response covers protocols, traffic volume, and
                  top conversations derived from packet visibility. Every tile
                  uses the selected live time range and reports an honest
                  no-data state when its source has not arrived.
                </InfoCard>
                <InfoCard title="Secure Networking dashboards">
                  All 16 Secure Networking Dashboard Studio views now use the
                  same clean dark three-by-two layout. Each dashboard tells a
                  six-KPI story from footprint through outcome: every card has
                  a concise explanation, a current value, a trend or
                  categorical graph, and a quiet Searchbase category and
                  sub-category label. Supporting tables and graphs move into
                  ordered in-dashboard drilldowns, so operators can move from
                  what changed to why it changed without leaving the dashboard.
                  Each value and graph pair shares one search, limiting the
                  initial canvas to six searches while details dispatch only
                  when opened. Dashboard Manager view mode still provides
                  Studio-style Display, zoom, JSON export, and clone controls.
                  Dashboard Manager now honors same-tab edit-route changes
                  immediately, opening the authoring toolbar without requiring
                  users to expand the view toolbar and click Edit.
                  Secure Infrastructure Status now spans Meraki access points,
                  Catalyst Center issues, SD-WAN sites, Nexus health, Secure
                  Endpoint incidents, and FMC firewall activity. ZTNA access
                  details now distinguish event records from distinct sessions
                  and identities, and ThousandEyes test-health details preserve
                  the visible test name through aggregation.
                  Across all five Secure Networking pillars, single-value cards
                  now use valid Searchbase-backed headline series and absolute
                  bucket-to-bucket changes when their source is chronological.
                  Categorical summary cards intentionally omit trends rather
                  than comparing unrelated rows. Numeric KPI and chart results
                  across all five pillars cap fractional values at two decimal
                  places while preserving whole-number counts. RaVPN cards now
                  distinguish active profiles, active regions, explicit failure
                  events, and posture-specific issues; generic connection failures
                  no longer masquerade as posture outcomes. Segmentation Readiness
                  now distinguishes endpoint-to-SGT assignments from the number of
                  distinct security groups in use and replaces the low-signal wired-port
                  exception metric with tagged SGT site activity. Command-map controls no longer
                  overlap its topology summary, and map-footer
                  KPI cards now expose Search and configuration actions.
                  Native single-value trend coloring now initializes without
                  emitting sparse-result range warnings while keeping
                  directional increase and decrease meaning.
                </InfoCard>
                <InfoCard title="Guided setup and performance readiness">
                  Setup now brings package checks, index macro discovery, data
                  model acceleration readiness, targeted Data Models links, and
                  the readiness query&apos;s Open in Search path into one flow.
                  It writes companion-app macros only when that app is enabled
                  and installed. Balanced mode remains available while
                  recommended acceleration is completed. Routing, CIM, and
                  performance changes remain drafts until the final review,
                  where administrators can compare current and proposed values
                  by target app. Cancel and Save and finish both require
                  confirmation, and long routing or CIM lists stay inside
                  bounded review tables with focused multiselect editors.
                  Routing index and sourcetype values now use native Splunk UI
                  chips with keyboard-safe expansion controls that retain focus
                  in both light and dark appearance.
                  Setup regression coverage now protects additive CIM
                  discovery, explicit model selection, failed-scan gating,
                  rerun preservation, and bounded final-review tables.
                </InfoCard>
                <InfoCard title="Insights Workspaces">
                  Workspaces now own their layout and presentation choices,
                  including sections, tiles, signal rail, map configuration,
                  within the shared dark theme. Secure Networking visualizations use the same
                  restrained operational palette and layered dark atmosphere
                  observed in Cisco Cloud Control, while Splunk&apos;s 1CD theme
                  customizer remains the component foundation. Signal Rail
                  One Cisco Glass styling now matches the original rectangular
                  cards, full-size semantic values, filled status pills, and
                  dark canvas without top accent strips. Configuration controls
                  stay hidden until hover or focus, and omit
                  the retired Cisco Blue Gradient option. Map-on-right layouts
                  default to the compact height while retaining a Match
                  workspace choice. The topology editor can now be moved and
                  resized within the map with mouse, touch, pen, or keyboard
                  controls, then returned to its default layout in one step.
                  Tile paging removes redundant navigation at
                  eight or all visible tiles; Configure Tile offers only the
                  supported visualization choices in a dropdown; and Searchbase
                  pickers use native disclosure chevrons with a direct View in
                  Searchbase link on every result. Tile drilldowns now use a
                  dedicated header icon beside the info control instead of an
                  overflow-menu entry. Meraki Rogue AP Count now demonstrates
                  multi-target drill-down navigation with containment and
                  threat-intelligence views.
                  Signal Rail
                  defaults are centrally managed, with
                  private account-and-workspace overrides for each signed-in
                  user. Headers prioritize the workspace title with compact
                  range and refresh controls, responsive health status, and
                  clear globe and layers iconography without duplicating
                  Splunk Web&apos;s account control. Signal Rails default to
                  comfortable density, offer small, standard, and large KPI
                  text, and use the full width without a fixed label block.
                  Tile drag and remove controls appear only from the top-left
                  action corner. Sections can collapse to a status summary or
                  enter a temporary focus view; compact charts automatically
                  trade static labels for plotting room and restore full detail
                  when focused. A template helps create the initial workspace
                  but does not constrain future customization. Detail
                  drilldowns size short result tables to their rows, cap long
                  tables with an internal scroller, and dedicate the remaining
                  dialog height to Searchbase guidance. Search and Searchbase
                  links sit together in detail headers, while Configure Tile
                  keeps View in Searchbase and Test in Search attached to the
                  currently bound search. Add Search results also expose a
                  direct View in Searchbase action without closing the drawer.
                  The User Guide now includes an
                  effective-access matrix for the <InlineCode>user</InlineCode>,{" "}
                  <InlineCode>power</InlineCode>, <InlineCode>admin</InlineCode>,
                  and <InlineCode>sc_admin</InlineCode> roles and the{" "}
                  <InlineCode>admin_all_objects</InlineCode> capability,
                  including fail-closed behavior and custom-role guidance.
                  A new capability-protected server endpoint lets custom roles
                  holding{" "}
                  <InlineCode>scd_manage_insights_workspaces</InlineCode>{" "}
                  manage shared workspaces, customer topology, and bounded
                  Dashboard Builder backgrounds without gaining factory
                  Searchbase write access.
                  Workspace Help now points to the tile action menu for
                  Configure tile and to the explicit top-right section link for
                  drill-down navigation.
                  Workspace layers return keyboard focus to the control that
                  opened them; clearing Configure tile filters returns focus to
                  the persistent Filters toggle without moving the drawer; and
                  the optional legacy rail speed now uses the same keyboard- and
                  pointer-safe Splunk UI slider as topology connector motion.
                  Agentic Security Operations Center now stages accelerated
                  Signal Rail and section searches in priority order, defaults
                  to two concurrent Splunk searches with a per-workspace 1–4
                  control, and does not dispatch tiles from collapsed sections.
                  Its conference catalogue uses 36 accelerated DNS, firewall,
                  Zeek, and DHCP searches backed by the three available
                  network data models. The guide also uses a
                  quieter documentation layout with
                  neutral inline code, consistent configuration blocks, wider
                  reading space, and simpler reference tables.
                </InfoCard>
                <InfoCard title="Dashboard Studio editing">
                  React preview pages now use dark-matched Splunk shells,
                  restrained semantic minimaps, readable topology zoom limits,
                  explicit selected-tab semantics, and collision-free metric
                  actions. The M365 visual preview is now clearly labeled as a
                  bundled sample dataset and reports the installed app build
                  instead of claiming live data or a hard-coded version.
                  Dashboard pages no longer show the fixed Splunk Inc.
                  copyright badge in the lower-right corner.
                  Dashboard Manager confirmation dialogs now use the edited
                  app&apos;s fixed dark SUI theme, including portal-rendered dialogs.
                  Dashboard creation, cloning, and generation now save into the
                  authenticated Splunk user&apos;s private namespace instead of
                  attempting an app-shared write as <InlineCode>nobody</InlineCode>.
                  Shared
                  factory dashboards keep their existing permissions, while
                  personal dashboards remain editable by their owner.
                  Internal Dashboard Studio drilldown links now open supporting
                  Searchbase searches inside Dashboard Manager with the active
                  dashboard time range. Their triggers use the same
                  open-details-panel icon as the home dashboard, and
                  multi-target links use Previous/Next navigation while
                  dispatching only the visible search. Each detail includes
                  the active search&apos;s category, sub-category, description,
                  explanation, solution, related information, and available
                  actions. Main canvases contain six KPI cards instead of
                  detail tables; supporting tables remain available inside the
                  drilldown. The Searchbase catalogue action describes adding
                  reusable searches instead of visualizations.
                </InfoCard>
                <InfoCard title="Searchbase and tile selection">
                  The IOS-XR CPU and interface-error anomaly searches now use
                  native sample-count, mean, standard-deviation, and z-score
                  baselines. They no longer require Splunk MLTK or pre-trained
                  model artifacts, and they fail closed for undersampled or
                  zero-variance series while preserving existing saved-canvas
                  display identifiers.
                  Searchbase Canvas distinguishes failed searches from other
                  attention states and adds app filtering. Its catalogue now
                  uses the same native Splunk UI filter pattern as Insights
                  Workspace, with consistent app, visibility, category,
                  visualization, tag, active-count, and clear controls.
                  Catalogue and tile pickers display friendly app labels with
                  the on-disk name available as hover detail. Insights
                  Workspace now hides configured searches by default, reports
                  visible and configured tile counts separately, and labels its
                  current-app, section-matched suggestions distinctly from the
                  all-app catalogue. The restored App filter spans installed
                  Searchbase providers, and the picker uses Add for me and Add
                  for everyone to distinguish private and shared tiles.
                </InfoCard>
                <InfoCard title="Contextual empty results">
                  Searchbase-backed Secure Networking panels now explain when no
                  matching telemetry exists in the selected time range, including
                  when the monitored condition may simply not have occurred. The
                  searches used by every Secure Networking Studio dashboard also
                  emit visualization-compatible fallback rows, so the guidance is
                  preserved outside Dashboard Manager. RadSec activity cards now
                  chart total authenticated activity instead of only failures,
                  and Security Exposure normalizes Nexus Dashboard advisory fields
                  while displaying the selected-window critical-advisory count.
                </InfoCard>
                <InfoCard title="Site connectivity">
                  The topology workflow can discover ThousandEyes agent-to-agent
                  site inputs, bind a selected test, and link operators to the
                  corresponding ThousandEyes test for deeper investigation.
                </InfoCard>
              </div>
              <p className="mt-5 text-sm leading-6 sui-color-default">
                This in-app section is the release-notes source for the current
                version. For upgrades, use the setup workflow after installation
                to confirm companion-package and data-model readiness before
                publishing a workspace to users.
              </p>
            </Section>

            <div className="grid gap-4 md:grid-cols-4">
              <InfoCard title="Network">
                <Wifi size={18} className="scd-guide-topic-icon" />
                Catalyst, SD-WAN, Zeek, Meraki, NVM, F5, and data center views.
              </InfoCard>
              <InfoCard title="Security">
                <Shield size={18} className="scd-guide-topic-icon" />
                Firewall, identity, endpoint, DNS, web, email, and incident
                views.
              </InfoCard>
              <InfoCard title="Experience">
                <Gauge size={18} className="scd-guide-topic-icon" />
                Client health, ThousandEyes, site readiness, and operations
                reporting.
              </InfoCard>
              <InfoCard title="Setup">
                <Settings size={18} className="scd-guide-topic-icon" />
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
