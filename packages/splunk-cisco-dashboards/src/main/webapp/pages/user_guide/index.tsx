/* eslint-disable react/jsx-filename-extension */
import React from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  ExternalLink,
  FileSearch,
  Gauge,
  GitBranch,
  Layers,
  LifeBuoy,
  Map,
  PlayCircle,
  Search,
  Settings,
  Shield,
  SlidersHorizontal,
  Wifi,
} from "lucide-react";

const APP_NAME = "splunk-cisco-dashboards";

const getSplunkLocale = (): string => {
  if (typeof window === "undefined") {
    return "en-US";
  }
  const localeMatch = window.location.pathname.match(/^\/([a-z]{2}-[A-Z]{2})\//);
  return localeMatch ? localeMatch[1] : "en-US";
};

const appUrl = (view: string): string => `/${getSplunkLocale()}/app/${APP_NAME}/${view}`;
const managerUrl = (app: string, page: string): string =>
  `/${getSplunkLocale()}/manager/${encodeURIComponent(app)}/${page}`;
const searchUrl = (q: string): string =>
  `/${getSplunkLocale()}/app/${APP_NAME}/search?q=${encodeURIComponent(q)}`;

const sectionLinkBase =
  "inline-flex h-9 items-center gap-2 rounded border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-sky-400 hover:text-sky-700";

function GuideLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={sectionLinkBase}>
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
    <section id={id} className="scroll-mt-5 border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded border border-sky-100 bg-sky-50 text-sky-700">
            {icon}
          </div>
          <div className="min-w-0">
            <h2 className="m-0 text-lg font-bold text-slate-950">{title}</h2>
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
  return (
    <pre className="m-0 overflow-auto rounded border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100">
      {children}
    </pre>
  );
}

const dashboards = [
  {
    title: "Executive Briefing",
    view: "overview",
    summary: "Executive landing page with health KPIs, signal rail, topology, and summary tiles.",
  },
  {
    title: "IT Health",
    view: "it_health_v1",
    summary: "Catalyst Center, ISE, ThousandEyes, device health, identity, and user experience.",
  },
  {
    title: "Security",
    view: "security_v1",
    summary: "Firewall, IPS, DNS, email, web, identity, endpoint, and security event visibility.",
  },
  {
    title: "Building Intelligence",
    view: "building_v1",
    summary: "Cisco Spaces, occupancy, building telemetry, wireless trust, and location intelligence.",
  },
  {
    title: "Cisco Spaces Intelligence",
    view: "spaces_intelligence_v1",
    summary: "Environmental, capacity, room, activation, visitor, and network impact analytics.",
  },
  {
    title: "Network Activation Report",
    view: "statewide_exercise_v1",
    summary: "Event operations view for executive, client, device, traffic, and issue summaries.",
  },
];

const macroFamilies = [
  {
    app: "splunk-cisco-dashboards",
    format: "index IN (idx1, idx2)",
    examples: "index_catalyst, index_firewall, index_f5, index_spaces, index_thousandeyes, and the other index_* macros",
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
    examples: "nvm_sysdata_index, nvm_process_index, nvm_flowdata_index, nvm_combined_index",
    note: "Used by the Cisco Security Cloud app data models.",
  },
  {
    app: "ta_cisco_thousandeyes",
    format: "(index=idx1 OR index=idx2)",
    examples: "stream_index, path_viz_index, activity_index, event_index, trace_index, alert_index",
    note: "Used by Cisco ThousandEyes data models and tstats-backed panels.",
  },
];

const dataSources = [
  ["Catalyst Center", "`cisco:dnac:*`, `cisco:catalyst:center:*`", "`index_catalyst`"],
  ["Firewall", "`cisco:asa`, `cisco:ftd*`, `cisco:sfw:estreamer`, `cisco:estreamer:*`", "`index_firewall`"],
  ["Identity", "`cisco:ise:*`, Windows and Active Directory sourcetypes", "`index_identity`, `index_windows`"],
  ["Network infrastructure", "`cisco:ios`, `cisco:ios:*`, `cisco:telemetry`, network syslog", "`index_network`"],
  ["Zeek NSM", "`zeek:conn`, `zeek:dns`, `zeek:ssl`, `zeek:http`, `zeek:notice`, and related Zeek logs", "`index_zeek`"],
  ["Meraki", "`meraki:*`", "`index_meraki`"],
  ["Cisco Spaces", "`cisco:spaces:*`", "`index_spaces`"],
  ["Security stack", "XDR, Umbrella/Secure Access, ESA, WSA, ETD, Defender, Secure Workload", "`index_security`"],
  ["DHCP", "Windows DHCP Server logs such as `DhcpSrvLog`", "`index_dhcp`"],
  ["ThousandEyes", "`cisco:thousandeyes:*` plus TA data model macros", "`index_thousandeyes`"],
  ["F5 BIG-IP", "`f5:bigip:*`", "`index_f5`"],
  ["Duo", "`cisco:duo:*`", "`index_duo`"],
  ["CyberVision", "`cisco:cybervision:*`", "`index_cybervision`"],
  ["UCS", "`cisco:ucs`, `cisco:ucs:*`", "`index_ucs`"],
  ["Cisco SD-WAN", "`cisco:sdwan:tunnelhealth`, `cisco:sdwan:sitehealth`, `cisco:sdwan:linkhealth`, `cisco:sdwan:*`", "`index_sdwan`"],
  ["Data Center", "`cisco:dc:aci:*`, `cisco:dc:nd:*`, `cisco:dc:nexus9k`", "`index_dc`"],
  ["Network Visibility Module", "`cisco:nvm:*`", "`index_nvm`"],
];

const supportMacros = [
  ["`customer_name`", "Controls the organization name shown in dashboard headers and report titles."],
  ["`scd_summariesonly`", "Controls tstats acceleration behavior for searches that can use accelerated data models."],
  ["`spaces_hierarchy(1)`", "Normalizes Cisco Spaces location hierarchy into campus, building, floor, and site fields."],
  ["`wireless_trust_base`", "Shared base search for wireless trust summary and device review panels."],
  ["`dnac_site_normalize(1)`", "Normalizes Catalyst Center site labels used across device and client panels."],
  ["`nrs_w_nrs_a`", "Network readiness score availability weight."],
  ["`nrs_w_nrs_r`", "Network readiness score reachability weight."],
  ["`nrs_w_nrs_q`", "Network readiness score quality weight."],
  ["`nrs_th_ap_health`", "Access point health threshold for readiness scoring."],
  ["`nrs_th_cl_health`", "Client health threshold for readiness scoring."],
  ["`nrs_ap_saturation_clients`", "AP client saturation threshold for readiness scoring."],
  ["`field_list`", "Utility macro used where dashboard searches need a reusable field projection."],
];

const troubleshootingRows = [
  ["Panels are empty", "Run Macro Index Tuning first, verify the time range, then open the panel in Search."],
  ["Searches are slow", "Tighten macros away from index=*, keep CIM discovery ranges short, and check tstats acceleration."],
  ["CIM panels are blank", "Run the CIM discovery section and save macros into Splunk_SA_CIM/local/macros.conf."],
  ["Site names are missing", "Refresh site_topology_lookup and verify client events carry siteId, siteHierarchyId, or siteHierarchy."],
  ["ThousandEyes links do not open", "Confirm permalink fields are absolute URLs and external navigation is allowed by Splunk Web."],
];

export default function UserGuidePage(): JSX.Element {
  const macroTuningUrl = appUrl("macro_index_tuning");
  const scdMacrosUrl = managerUrl(APP_NAME, "data/macros");
  const cimMacrosUrl = managerUrl("Splunk_SA_CIM", "data/macros");

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1680px] px-6 py-8 lg:px-8">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-sky-800">
                <LifeBuoy size={14} />
                Splunk Cisco Dashboards
              </div>
              <h1 className="m-0 text-3xl font-bold tracking-normal text-slate-950">
                User Guide
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
                Setup and operating guide for deploying the app, tuning macros,
                validating data sources, and keeping the executive dashboards useful
                after the first install.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <GuideLink href={macroTuningUrl}>
                <SlidersHorizontal size={15} />
                Macro Index Tuning
              </GuideLink>
              <GuideLink href={searchUrl("| tstats count where index=* by index sourcetype")}>
                <Search size={15} />
                Open Data Check
              </GuideLink>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1680px] gap-5 px-6 py-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-8">
        <aside className="hidden lg:block">
          <nav className="sticky top-4 border border-slate-200 bg-white p-3 text-sm">
            {[
              ["Overview", "#overview"],
              ["Install", "#install"],
              ["Macro Tuning", "#macro-tuning"],
              ["Data Sources", "#data-sources"],
              ["Dashboards", "#dashboards"],
              ["Lookups", "#lookups"],
              ["Operations", "#operations"],
              ["Troubleshooting", "#troubleshooting"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="block rounded px-3 py-2 font-semibold text-slate-700 hover:bg-sky-50 hover:text-sky-800"
              >
                {label}
              </a>
            ))}
          </nav>
        </aside>

        <div className="grid gap-5">
          <Section
            id="overview"
            title="What This App Provides"
            kicker="Cisco-focused executive, operational, workplace, security, and event dashboards."
            icon={<Gauge size={19} />}
          >
            <div className="grid gap-4 md:grid-cols-3">
              <InfoCard title="Executive summaries">
                Health KPIs, topology, client experience, security, building intelligence,
                and event operations views designed for fast situation awareness.
              </InfoCard>
              <InfoCard title="Operational depth">
                Tabs expose source-specific detail for Catalyst Center, Cisco Spaces,
                ThousandEyes, ISE, firewall, endpoint, and related telemetry.
              </InfoCard>
              <InfoCard title="Tunable search model">
                Searches call macros instead of hardcoded indexes so the same dashboard
                package can run cleanly in different Splunk environments.
              </InfoCard>
            </div>
          </Section>

          <Section
            id="install"
            title="Day-One Setup"
            kicker="Use this sequence after installing the app and required Cisco add-ons."
            icon={<PlayCircle size={19} />}
          >
            <ol className="m-0 grid gap-3 pl-5 text-sm leading-6 text-slate-700">
              <li>Install the app and any technology add-ons that collect your Cisco, Windows, CIM, and ThousandEyes data.</li>
              <li>Confirm events are present with a broad data check before tuning dashboards.</li>
              <li>Open Macro Index Tuning and run the fast scan for dashboard macros.</li>
              <li>Save the generated SCD macros, then save any Cisco Security Cloud and ThousandEyes model macros that apply.</li>
              <li>Run CIM discovery separately with a short range, then save the CIM macros into Splunk_SA_CIM.</li>
              <li>Refresh the app in Splunk Web, load the dashboards, and use Open in Search on any empty panel.</li>
            </ol>
            <div className="mt-4 flex flex-wrap gap-2">
              <GuideLink href={macroTuningUrl}>
                <SlidersHorizontal size={15} />
                Open Macro Index Tuning
              </GuideLink>
              <GuideLink href={searchUrl("| tstats count where index=* by index sourcetype | sort -count")}>
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
                  The <strong>Macro Index Tuning</strong> dashboard is a React view mounted
                  by <code className="rounded bg-slate-100 px-1 py-0.5">macro_index_tuning.xml</code>.
                  The fast scan uses the <code className="rounded bg-slate-100 px-1 py-0.5">admin_macro_index_tuning</code>
                  searchbase entry, which performs a tstats pass over known Cisco
                  sourcetypes and generates macro definitions.
                </p>
                <p className="m-0">
                  CIM discovery is intentionally separate because it uses tag-based raw
                  searches such as authentication and network communication tags. Keep
                  that range short unless you are validating a new deployment.
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
                    <li>SCD macros save to <code>splunk-cisco-dashboards/local/macros.conf</code>.</li>
                    <li>CIM macros save to <code>Splunk_SA_CIM/local/macros.conf</code>.</li>
                    <li>Cisco Security macros save to <code>CiscoSecurityCloud/local/macros.conf</code>.</li>
                    <li>ThousandEyes macros save to <code>ta_cisco_thousandeyes/local/macros.conf</code>.</li>
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
                    <tr key={row.app} className="border-b border-slate-100 align-top">
                      <td className="px-3 py-3 font-mono text-xs text-sky-800">{row.app}</td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-700">{row.format}</td>
                      <td className="px-3 py-3 text-slate-700">{row.examples}</td>
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
                    <th className="w-[48%] px-3 py-2 font-bold">Sourcetypes or Inputs</th>
                    <th className="w-[28%] px-3 py-2 font-bold">Macro</th>
                  </tr>
                </thead>
                <tbody>
                  {dataSources.map(([area, sourcetypes, macro]) => (
                    <tr key={area} className="border-b border-slate-100 align-top">
                      <td className="px-3 py-3 font-bold text-slate-800">{area}</td>
                      <td className="px-3 py-3 text-slate-700">{sourcetypes}</td>
                      <td className="px-3 py-3 font-mono text-xs text-sky-800">{macro}</td>
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
                      <tr key={macro} className="border-b border-slate-200 align-top last:border-b-0">
                        <td className="w-[30%] px-3 py-3 font-mono text-xs text-sky-800">{macro}</td>
                        <td className="px-3 py-3 text-slate-700">{purpose}</td>
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
            icon={<Map size={19} />}
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
                    <ExternalLink size={15} className="shrink-0 text-slate-400 group-hover:text-sky-700" />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{dashboard.summary}</p>
                  <div className="mt-3 font-mono text-xs text-sky-800">{dashboard.view}</div>
                </a>
              ))}
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
                Search definitions live in <code>default/searchbase.conf</code> as the
                catalogue for dashboard SPL, admin references, and helper tooling.
                React utilities can read this catalogue when a page needs to expose
                or run a named search.
              </InfoCard>
              <InfoCard title="site_topology_lookup">
                The scheduled Site Topology Lookup Generator snapshots Catalyst
                Center site topology into <code>site_topology_lookup.csv</code> so client
                and device panels can turn site IDs into readable site names.
              </InfoCard>
              <InfoCard title="scd_summariesonly">
                This macro controls tstats acceleration behavior for searches that can
                use summaries. Tune it deliberately for your environment.
              </InfoCard>
              <InfoCard title="Dashboard Studio and React">
                Most operational dashboards are Dashboard Studio XML. Utility pages
                such as Macro Index Tuning and this guide are React bundles mounted
                inside Simple XML shells.
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
                Rerun Macro Index Tuning and save updated macros before troubleshooting
                individual panels.
              </InfoCard>
              <InfoCard title="After add-on changes">
                Recheck sourcetype names and field extraction. The dashboards expect
                normalized Cisco and CIM fields.
              </InfoCard>
              <InfoCard title="After app upgrades">
                Compare local macro overrides with new defaults, then refresh Splunk Web
                so updated JavaScript bundles and dashboard definitions load.
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
                      <td className="px-3 py-3 font-bold text-slate-800">{symptom}</td>
                      <td className="px-3 py-3 text-slate-700">{check}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <GuideLink href={searchUrl("| tstats count where index=* by index sourcetype | sort -count")}>
                <FileSearch size={15} />
                Data Inventory
              </GuideLink>
              <GuideLink href={searchUrl("| inputlookup site_topology_lookup | stats count by type")}>
                <GitBranch size={15} />
                Site Lookup Check
              </GuideLink>
              <GuideLink href={appUrl("searchbase_canvas")}>
                <CheckCircle2 size={15} />
                Searchbase Canvas
              </GuideLink>
            </div>
          </Section>

          <div className="grid gap-4 md:grid-cols-4">
            <InfoCard title="Network">
              <Wifi size={18} className="mb-2 text-sky-700" />
              Catalyst, SD-WAN, Zeek, Meraki, NVM, F5, and data center views.
            </InfoCard>
            <InfoCard title="Security">
              <Shield size={18} className="mb-2 text-red-600" />
              Firewall, identity, endpoint, DNS, web, email, and incident views.
            </InfoCard>
            <InfoCard title="Experience">
              <Gauge size={18} className="mb-2 text-emerald-700" />
              Client health, ThousandEyes, site readiness, and activation reporting.
            </InfoCard>
            <InfoCard title="Setup">
              <Settings size={18} className="mb-2 text-slate-700" />
              Macro tuning, lookup health, and searchbase reference tooling.
            </InfoCard>
          </div>
        </div>
      </div>
    </main>
  );
}
