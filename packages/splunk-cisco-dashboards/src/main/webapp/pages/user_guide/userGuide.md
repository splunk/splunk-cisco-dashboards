---
exportTitle: Splunk Secure Networking Essentials User Guide
contentOwner: splunk-cisco-dashboards
---
<!-- Single source of truth for the in-product User Guide. Keep customer-facing narrative here. -->

## What This App Provides {#overview}

Splunk Secure Networking Essentials provides Cisco-focused executive, operational, workplace, security, and event dashboards. It visualizes data already ingested into Splunk; it does not collect Cisco data directly.

- **Executive summaries:** health KPIs, topology, client experience, security, building intelligence, and event operations views.
- **Operational depth:** source-specific detail for Catalyst Center, Cisco Spaces, ThousandEyes, ISE, firewall, endpoint, and related telemetry.
- **Tunable search model:** searches call macros instead of hard-coded indexes so the package works across Splunk environments.

## Prerequisites {#prerequisites}

Install the supporting apps required by the dashboards you plan to use. Not every integration is required for every dashboard.

| Dependency | App folder | Data model | Purpose |
| --- | --- | --- | --- |
| Cisco Security Cloud | `CiscoSecurityCloud` | `Cisco_Security` | Cisco security model-backed content and macros |
| Cisco Intersight Add-On | `Splunk_TA_Cisco_Intersight` | `Cisco_Intersight` | Intersight telemetry and model coverage diagnostics |
| Cisco ThousandEyes App | `ta_cisco_thousandeyes` | `Cisco_ThousandEyes` | ThousandEyes model macros and panels |
| Cisco Enterprise Networking App | `cisco-catalyst-app` | `Cisco_Catalyst_App` | Catalyst Center, ISE, Meraki, SD-WAN, and NetFlow datasets |
| Splunk AI Toolkit | installed app | Not applicable | Searches using `fit` or `apply` |

Users also need permission to search the selected indexes and use any referenced knowledge objects or data models.

## Install and Upgrade {#install}

Install the Splunkbase package through **Apps > Manage Apps**, or deploy it through your normal Splunk app-management process. After installation, open Setup and validate the supporting apps before tuning index macros.

For upgrades, back up local configuration, install the new package, and review the release notes. Default files may change during upgrade; customer changes belong in `local`, not `default`.

## Macro Index Tuning {#macro-tuning}

Setup discovers where supported Cisco source types are indexed and proposes macro allowlists. Review every proposal before saving it.

1. Open **Setup** and choose **Configure data**.
2. Run source-type discovery with a short representative time range.
3. Review each proposed app macro and its indexes.
4. Continue to CIM tuning when applicable, or continue without selecting a CIM model.
5. Review the draft plan and save it.

Primary app macros use forms such as `index IN (network, security)`. CIM macros use the syntax required by `Splunk_SA_CIM`. Discovery does not grant index access and does not modify source data.

### CIM tuning

CIM discovery runs one bounded search per data model so a slow or unavailable model does not block all results. Select only the models whose saved index allowlists should change. Unselected models remain unchanged.

Data-model acceleration is separate from macro tuning. Use the readiness links in Setup to inspect and enable acceleration where the deployment requires it.

For each search, use an accelerated CIM model when it preserves the required meaning and fields; use a Cisco app or add-on model for vendor-specific coverage; and use raw indexed events only when neither model can represent the search faithfully.

## Data Sources {#data-sources}

| Product area | Typical source types | Primary macro |
| --- | --- | --- |
| Catalyst Center | `cisco:dnac:*`, `cisco:catalyst:center:*` | `index_catalyst` |
| Firewall | `cisco:asa`, `cisco:ftd*`, `cisco:sfw:*`, `cisco:sourcefire:*` | `index_firewall` |
| Identity | `cisco:ise:*`, Windows, Active Directory | `index_identity`, `index_windows` |
| Network infrastructure | `cisco:ios*`, `cisco:telemetry`, network syslog | `index_network` |
| Meraki | `meraki:*` | `index_meraki` |
| Cisco Spaces | `cisco:spaces:*` | `index_spaces` |
| ThousandEyes | `cisco:thousandeyes:*` | `index_thousandeyes` |
| Intersight | `cisco:intersight:*` | `index_intersight` |
| Cisco SD-WAN | `cisco:sdwan:*` | `index_sdwan` |
| Data Center | `cisco:dc:aci:*`, `cisco:dc:nd:*`, `cisco:dc:nexus9k` | `index_dc` |
| Security stack | XDR, Umbrella, Secure Access, Secure Endpoint, and related Cisco sources | `index_security` |

Dashboard results depend on source types, normalized fields, data models, index mappings, permissions, and the selected time range.

## Dashboards {#dashboards}

Dashboard Manager organizes the supplied Dashboard Studio experiences by secure-networking pillar. Use the time picker for the investigation window; trend searches generally allow `timechart` to choose an automatic span.

- **Executive Briefing:** cross-domain KPIs and leadership-ready summaries.
- **Zero Trust Access:** identity, authentication, remote access, and policy enforcement.
- **Secure Infrastructure:** infrastructure health, data-center operations, devices, and availability.
- **Scalable Network Segmentation:** TrustSec, SGT adoption, and enforcement posture.
- **Hybrid Mesh Firewalling:** firewall policy, threats, blocked traffic, and coverage.
- **Agentic Ops:** operational signals and assisted investigation workflows.
- **Digital Experience and Workplace:** ThousandEyes, client experience, Cisco Spaces, occupancy, and building intelligence.

Use **Open in Search** to inspect the exact SPL with the active tokens and time range.

## Insights Workspaces {#workspaces}

Insights Workspaces are reusable executive views. Each workspace can choose its header, sections, KPI tiles, signal rail, topology map, visible tile count, map placement, and presentation defaults.

### Create a workspace {#workspaces-create-a-workspace}

1. Open **Edit workspaces** from the workspace switcher.
2. Select **New**.
3. Enter a display name and unique workspace ID.
4. Choose **Start from a template** or select sections manually.
5. Configure map placement, visible tiles, header title, subtitle, and sections.
6. Select **Save workspace**.

Creating a workspace saves shared metadata and section choices. It does not automatically publish every viewer-side tile arrangement.

### Add and publish searches {#workspaces-add-and-publish-searches}

Use **Add search** in a section to add a tile for yourself or, with the required capability, for everyone. The catalogue defaults to searches from `splunk-cisco-dashboards`; users may expand the app filter to browse compatible searches from other Searchbase providers.

Arrange the workspace, then select **Publish workspace layout** to save the shared layout. Use **Configure Signal Rail** to choose and order shared signal-rail items.

### Where workspace settings are saved {#workspaces-where-settings-are-saved}

| Setting | Scope | Backing store |
| --- | --- | --- |
| Workspace metadata and section choices | Shared | `local/insights_workspaces.conf` |
| Published layout and shared signal rail | Shared | workspace stanzas in `local/insights_workspaces.conf` |
| Customer topology and map definitions | Shared | `local/customer_topology.conf` |
| Per-user workspace preferences | User | `insights_workspace_preferences.conf` through Splunk REST storage |
| Unpublished layout and appearance | Browser | browser local storage, with a first-party cookie fallback where needed |

Browser-local changes are private to that browser until published. Clearing browser storage can remove unpublished preferences. Configuration-file changes are durable and visible according to Splunk permissions.

### Workspace permissions by role and capability {#workspaces-workspace-permissions-by-role-and-capability}

Workspace creation, duplication, shared edits, publishing, and deletion require `ssne_manage_insights_workspaces`. The app grants this capability to `admin` and `sc_admin` by default. The standard `user` and `power` roles can view workspaces and keep personal browser preferences but cannot publish shared configuration unless an administrator grants the capability. `admin_all_objects` alone is not a substitute for the app capability.

> Workspace permission does not grant access to indexed data. A viewer still needs the `search` capability, index permissions, data-model access, and knowledge object permissions required by each tile.

### Workspace lifecycle

- **Duplicate** creates a new editable workspace from an existing definition.
- **Reset workspace to factory defaults** removes local presentation preferences; it does not delete shared workspace configuration.
- Built-in workspaces are app-provided. Customer-created workspaces are stored locally and survive app upgrades when Splunk deployment practices preserve `local`.

## Site Connectivity {#site-connectivity}

The topology editor controls the workspace map title, subtitle, center, zoom, sites, links, roles, and telemetry search. Map configuration is shared through `local/customer_topology.conf`; the currently selected base-map view and presentation choices may be browser preferences.

Use **Use current view** to copy the visible map center and zoom into the editor, then save. Validate site names and coordinates before publishing. Leave Esri and Leaflet attribution visible when their map tiles or rendering library require it.

## Lookups {#lookups}

Lookups enrich dashboard results with site names, topology, thresholds, and product context. Keep customer-managed lookup content in supported local or KV-store locations and preserve the required headers.

If a lookup-backed panel is empty, verify that the lookup exists, the user can read it, and source events contain the join fields expected by the search.

## Operations {#operations}

- Start with a narrow time range and expand only when the question requires it.
- Investigate empty or surprising panels with **Open in Search**.
- Keep index macros bounded; avoid broad `index=*` definitions in production.
- Monitor accelerated data-model health for `tstats` searches.
- Re-run Setup discovery after onboarding a new Cisco data source or moving data between indexes.
- Use the app version and build shown in the header when reporting a problem.

## Troubleshooting {#troubleshooting}

| Symptom | Recommended action |
| --- | --- |
| Panels are empty | Run Tune indexes, confirm the time range, then open the panel in Search. |
| Searches are slow | Narrow index macros, shorten discovery windows, and inspect data-model acceleration. |
| CIM panels are blank | Confirm tags, event types, CIM macros, data-model permissions, and acceleration status. |
| Workspace cannot be saved | Confirm `ssne_manage_insights_workspaces` and inspect the REST error returned by Splunk. |
| Personal layout disappeared | Check whether browser storage or cookies were cleared; publish layouts that must be shared. |
| Site names are missing | Refresh topology lookups and verify the event site identifiers. |
| A search behaves differently after field projection | Open it in Search and disable search optimization for pipelines affected by optimizer field pruning. |

## What's New / Release Notes {#release-notes}

Release history is stored in this Markdown file so the in-product guide and future export tooling share one authoritative source.

::: release Current release at a glance | Source workspace changes
### Highlights

- Added and refined configurable Insights Workspaces, signal rails, topology editing, themes, and audience-specific views.
- Expanded Cisco, CIM, Intersight, ThousandEyes, Spaces, security, and data-center search coverage.
- Improved setup discovery, macro tuning, data-model readiness, packaging validation, and customer-facing documentation.
- Dashboard Manager now makes Edit visible when editing can resume, and the search picker supports compact rows with secondary metadata on demand.
- Open in Search accepts only dashboard-defined safe filter values.
- Topology palette items and key manager/KPI controls now support complete keyboard operation.
- Shared edits use bounded Dashboard Builder background operations with explicit capability delegation.
- `build.sh --install` uses the SplunkBase profile by default; `--developer` and `--fast` are explicit local-development workflows.
- SplunkBase build, install, and archive generation use one clean-source packaging path so local installation verifies the exact release-eligible archive.
- A successful SplunkBase install produces an upload-ready archive; the target's installed build does not affect package construction.
- Custom Insights workspaces can now be created from template choices with circular radio controls.
- Insights workspace editors, drawers, map controls, fields, and buttons use readable Splunk UI colors in both light and dark modes.
- Add search now opens and resets with only this app selected; the Entire catalogue remains available through the app filter.
- Agentic SOC section headers no longer expose actions that lead to the development-only Searchbase Canvas.
- **Secure Data Center Operations:** added ACI fabric health, infrastructure performance, runtime security, and change intelligence views.
- Release identity comes from the repository-root VERSION file. Source app.conf and app.manifest retain placeholders, while release packaging can allocate the next package build automatically.
- patched known npm security advisories, including the MapLibre GL JS XSS advisory, while ensuring Splunk visualizations continue to compile.
- Site placement uses an offline city list or explicit coordinates; customer site text is never sent to a public geocoder.
:::

::: release Published package record | Version 1.0.46
### Highlights

- Expanded dashboard and workspace coverage while improving setup, search validation, and release packaging.
- Added customer topology, shared workspace controls, and clearer operational guidance.
:::

::: release Initial beta release | Version 1.0.45
This is the first beta release of Splunk App for Secure Networking. It provides Cisco-focused dashboards, configurable workspaces, and investigation tools in Splunk Enterprise.

### Highlights

- Organizes content around Zero Trust Access, Secure Infrastructure, Scalable Network Segmentation, Hybrid Mesh Firewalling, and Agentic Ops.
- Includes 16 Cisco-themed Dashboard Studio views for executive insights, operations, infrastructure health, workplace intelligence, and investigations.
- Provides configurable Insights Workspaces with KPI tiles, layouts, signal rails, connectivity maps, themes, and audience-specific views.
- Includes Dashboard Manager tools for creating, editing, cloning, exporting, and presenting dashboards.
- Adds interactive topology tools, drilldowns, Open in Search actions, and a searchable catalogue of shared searches.

### Setup and data readiness

- Guides users through supporting-app validation, Cisco source-type discovery, index-macro configuration, and data-model acceleration checks.
- Supports macro configuration for Cisco networking, security, observability, infrastructure, and workplace integrations.
- Includes this in-app User Guide for setup, dependencies, performance readiness, and troubleshooting.

### Beta considerations

- This release is available only to approved beta participants.
- The app visualizes data already indexed in Splunk Enterprise; it does not collect Cisco data.
- Results depend on integrations, source types, fields, data models, index mappings, permissions, and time ranges.
- Features, content, and compatibility can change before general availability.
:::

::: release Initial Alpha release | Version 1.0.44
This is an Alpha release of Splunk App for Secure Networking. It provides Cisco-focused executive, network operations, security operations, infrastructure, and building-intelligence experiences within Splunk.

### Highlights

- Introduces experiences organized around Zero Trust Access, Secure Infrastructure, Scalable Network Segmentation, Hybrid Mesh Firewalling, and Agentic Ops.
- Includes 16 Cisco-themed Dashboard Studio views containing executive KPIs, operational trends, security findings, topology context, and investigation workflows.
- Adds configurable Insights Workspaces, Dashboard Manager tools, interactive topology, drilldowns, Open in Search, and a shared-search catalogue.

### Data configuration and readiness

- Adds guided setup, sourcetype discovery, index macro tuning, separate CIM macro discovery, and acceleration readiness links.
- Supports companion Cisco networking, security, ThousandEyes, Meraki, Intersight, and Spaces integrations.

### Security and operational content

- Includes authentication, policy enforcement, activity, VPN, segmentation, infrastructure health, firewall, and threat-detection dashboards.
- Provides Cisco Catalyst Center, Secure Firewall, ISE, Meraki, ThousandEyes, Spaces, Duo, Cyber Vision, UCS, Intersight, SD-WAN, data-center networking, Secure Access, and XDR content where telemetry is present.

### Alpha release considerations

- Available only to approved Alpha participants.
- The app visualizes existing Splunk data and does not collect Cisco data directly.
- Results depend on supporting apps, source types, fields, data models, index mappings, permissions, and time ranges.
- Alpha functionality and compatibility may change before general availability.
:::

::: release Initial Alpha release | Version 1.0.35
This is the first Alpha release of Splunk App for Secure Networking. It provides Cisco-focused executive, network operations, security operations, infrastructure, and building-intelligence experiences within Splunk.

### Highlights

- Introduces experiences organized around Zero Trust Access, Secure Infrastructure, Scalable Network Segmentation, Hybrid Mesh Firewalling, and Agentic Ops.
- Includes 16 Cisco-themed Dashboard Studio views containing executive KPIs, operational trends, security findings, topology context, and investigation workflows.
- Provides executive briefing, IT health, security, Asset Inventory, NetOps Readiness, Cisco Spaces, workplace, and building-intelligence views.
- Adds configurable Insights Workspaces with KPI tiles, layouts, signal rails, site-connectivity maps, presentation themes, and audience-specific views.
- Includes Dashboard Manager, interactive topology, drilldowns, Open in Search, and a shared-search catalogue.

### Data configuration and readiness

- Adds guided setup for supporting apps, Cisco sourcetypes, and index macros.
- Provides app and CIM macro tuning, data-model acceleration readiness, and companion Cisco integration support.
- Includes an in-app guide for setup, dependencies, workspaces, site connectivity, performance readiness, and troubleshooting.

### Security and operational content

- Includes authentication, policy enforcement, activity, VPN, segmentation, infrastructure health, firewall, and threat-detection dashboards.
- Provides Palo Alto policy outcomes, Cisco ISE SGT correlation, SD-WAN controller threat hunts, and supported Cisco product content.

### Alpha release considerations

- Available only to approved Alpha participants.
- The app visualizes existing Splunk data and does not collect Cisco data directly.
- Results depend on supporting apps, source types, fields, data models, index mappings, permissions, and time ranges.
- Not every supporting integration is required for every dashboard.
- Some features require accelerated data models or optional supporting apps.
- Alpha functionality and compatibility may change before general availability.
:::
