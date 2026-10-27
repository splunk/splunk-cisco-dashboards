---
exportTitle: Splunk Secure Networking Essentials User Guide
contentOwner: splunk-cisco-dashboards
version: 1.0.80
lastUpdated: October 2026
---
<!-- Single source of truth for the in-product User Guide and release history. -->

## What this app provides {#overview}

Splunk Secure Networking Essentials provides Cisco-focused dashboards, configurable executive workspaces, and investigation tools in Splunk Enterprise. The app visualizes data that supporting Cisco apps, add-ons, and other integrations have already indexed. It does not collect Cisco data directly.

Use the app to:

- Review executive health, risk, experience, and operational signals in Insights Workspaces.
- Investigate identity, infrastructure, segmentation, firewall, data-center, application, and workplace telemetry in Dashboard Studio views.
- Open a panel's exact search and active time range in Splunk Search.
- Tune index macros so packaged searches work with the indexes in your environment.
- Review Common Information Model (CIM) and Cisco data-model readiness before relying on accelerated searches.

### Common tasks

| I need to | Go to |
| --- | --- |
| Complete initial configuration | **More > Administration > Setup** |
| Map Cisco data to the correct indexes | **Setup > Configure data** |
| Tune optional CIM index allow lists | **Setup > Tune CIM models** |
| Create or duplicate an executive workspace | **Home > workspace switcher > Edit workspaces** |
| Add a KPI tile | Open a workspace section and select **Add search** |
| Save a layout for every viewer | Select **Publish workspace layout** |
| Configure the shared KPI strip | Select **Configure Signal Rail** |
| Investigate a dashboard card | Select **About this metric**, **Investigate drivers**, or **Open in Search** |

## Prerequisites {#prerequisites}

Install only the supporting products required by the dashboards you plan to use. Not every integration is required for every dashboard.

| Dependency | App folder | Data model | How the app uses it |
| --- | --- | --- | --- |
| Splunk Common Information Model add-on | `Splunk_SA_CIM` | Authentication, Change, Endpoint, Intrusion Detection, Network Resolution, Network Sessions, Network Traffic, and Web | Portable CIM-first searches and index allow lists |
| Cisco Security Cloud | `CiscoSecurityCloud` | `Cisco_Security` | Cisco security model macros and vendor-specific security fields |
| Cisco Intersight Add-On for Splunk | `Splunk_TA_Cisco_Intersight` | `Cisco_Intersight` | Intersight telemetry, acceleration readiness, and model coverage |
| Cisco ThousandEyes App for Splunk | `ta_cisco_thousandeyes` | `Cisco_ThousandEyes` | ThousandEyes model macros, application experience, and path telemetry |
| Cisco Enterprise Networking App for Splunk | `cisco-catalyst-app` | `Cisco_Catalyst_App` | Catalyst Center, ISE, Meraki, SD-WAN, NetFlow, health, inventory, and audit datasets |
| Splunk AI Toolkit | Installed app | Not applicable | Searches that use commands such as `fit` or `apply` |

Every viewer also needs app access, the `search` capability, permission to search the selected indexes, and permission to use referenced data models and knowledge objects.

### Search selection policy

For each search, use an accelerated CIM model when it preserves the required meaning and fields; use a Cisco app or add-on model for vendor-specific coverage; and use raw indexed events only when neither model can represent the search faithfully.

1. Use an accelerated CIM data model when it preserves the required meaning and fields.
2. Use a Cisco app or add-on data model for vendor-specific fields that CIM does not represent.
3. Search raw indexed events only when neither data-model option can represent the search accurately.

Data-model acceleration improves eligible `tstats` searches but does not replace correct data ingestion, tagging, field extraction, or index permissions.

For event counts and freshness that need only indexed fields (such as index, sourcetype, and time), use index-backed `tstats` directly. This avoids raw payload scans without depending on model tagging or summary freshness. Do not replace source-feed health with summary health.

For model-backed searches, the shared `summariesonly` setting controls whether incomplete summaries may be supplemented from unsummarized data. Summary-only mode can be faster but can omit recent or uncovered events. Validate acceleration coverage before enabling it; shortening the dashboard window does not repair a coverage gap. Event-detail searches may still need raw fields. Apply expensive display enrichment after bounded selection when this preserves filtering and ranking.

## Install and upgrade {#install}

### Install the app

1. In Splunk Web, open **Apps > Manage Apps**.
2. Select **Install app from file**.
3. Upload the Splunkbase package and follow your deployment policy for app installation.
4. Open Splunk Secure Networking Essentials and start Setup.
5. Complete the guided review before opening the dashboard workspace.

Distributed and Splunk Cloud deployments must use their normal app-management process. Installation can require an operator-controlled Splunk restart when new endpoint configuration is loaded. Saving Setup choices after installation does not require a restart.

### Complete initial Setup

Setup contains six stages:

1. **Welcome:** review what Setup changes and start the guided flow.
2. **Verify readiness:** check the Splunk environment and required capabilities.
3. **Review packages:** confirm which supporting apps and add-ons are installed and enabled.
4. **Configure data:** scan a bounded time range, review routing macro proposals, and choose the search-performance mode.
5. **Tune CIM models:** run one bounded discovery search per CIM data model. Models backed by matching data are selected automatically; clear any allow list that you want to leave unchanged. You can select **Skip CIM tuning** when no model remains selected.
6. **Review & finish:** compare current and proposed values, then select **Save changes and finish**. Setup persists every reviewed user-tunable app routing macro and matched CIM allow list to the owning app's local configuration, including definitions that currently match a shipped default. TA-owned Cisco DC Networking macros and the Cisco Enterprise Networking sourcetype allow-list macro remain outside this user-driven save path.

Nothing is written until the final confirmation. Canceling Setup discards the draft plan.

### Upgrade the app

Back up customer-managed `local` configuration before an upgrade. Packaged defaults can change, but customer changes belong in `local`, not `default`. After upgrading:

1. Open Setup and review package readiness.
2. Re-run Configure data if indexes or source types changed.
3. Review optional CIM discovery and data-model acceleration.
4. Open representative dashboards with the roles that use them.
5. Confirm the installed version and build displayed in the app header when reporting a problem.

The version label shows the installed app version and build. In Insights Workspaces, a separate update badge appears beside it when Splunk reports a newer version. Select the badge to open the upgrade flow. If Splunk has not discovered an update or the update check is unavailable, the badge stays hidden; its absence does not confirm that you have the latest release.

### Validate an integrated Splunk Cloud upgrade

Use the tenant's approved app-management process to install the available release. A local installation or a Splunkbase listing does not confirm that a cloud tenant has upgraded. Read back the installed version and build before testing.

With the same restricted account and launch path used by viewers, check that:

- The workspace loads and searches complete with the intended index and knowledge-object permissions.
- Typing `r` and `t` in the Cisco Cloud Control assistant keeps the letters without refreshing the background workspace or changing its time range.
- Clicking the workspace background, then pressing `r` or `t`, refreshes the data or cycles the time range. Repeat after moving focus to a workspace control; typing in the assistant must still leave the background unchanged.
- Dashboard creation, personal preferences, and sharing follow the account's permissions.
- If **Add to AI Canvas** is available, a new and an existing canvas receive the intended search and time range, and the resulting card opens successfully.

Test expected simultaneous usage separately. A successful administrator session or a single-user check does not establish shared-demo capacity.

## Macro index tuning {#macro-tuning}

Setup discovers indexes that contain supported Cisco source types and proposes bounded macro definitions. Review every proposal before saving it.

TA-owned Cisco DC Networking routing macros and the Cisco Enterprise Networking sourcetype allow-list macro are not user-tunable in this workflow. Their definitions remain static here and can continue to change through the owning TA's upgrade path.

### Configure app and companion macros

1. Open **Setup > Configure data**.
2. Choose a short time range that contains representative data.
3. Select **Run scan**.
4. Review the detected indexes and source types for each macro.
5. Edit a proposal when the detected scope is incomplete or too broad.
6. Choose **Balanced** while raw-event fallback is required, or choose the accelerated mode only after its required data models are ready.
7. Continue to CIM tuning or the final review.

Primary app macros use definitions such as `index IN (network, security)`. CIM and some companion-app macros use expressions such as `(index=network OR index=security)`.

| Macro owner | Examples | Saved location |
| --- | --- | --- |
| Splunk Secure Networking Essentials | `index_catalyst`, `index_firewall`, `index_spaces`, `index_security` | `splunk-cisco-dashboards/local/macros.conf` |
| Splunk Common Information Model add-on | `cim_Authentication_indexes`, `cim_Network_Traffic_indexes` | `Splunk_SA_CIM/local/macros.conf` |
| Cisco Security Cloud | `nvm_sysdata_index`, `nvm_process_index`, `nvm_flowdata_index` | `CiscoSecurityCloud/local/macros.conf` |
| Cisco Intersight Add-On for Splunk | `cisco_intersight_index` | `Splunk_TA_Cisco_Intersight/local/macros.conf` |
| Cisco ThousandEyes App for Splunk | `stream_index`, `path_viz_index`, `activity_index`, `event_index`, `trace_index`, `alert_index` | `ta_cisco_thousandeyes/local/macros.conf` |

### Tune CIM models

CIM discovery is separate from source-type discovery because it evaluates each model's root CIM tags against the configured indexes before reading or changing saved allowlists. It runs one search per data model, allows two searches in flight, preserves completed results, reports progress, and allows cancellation. A slow or unavailable model therefore does not block all other models.

Every model backed by matching data enters the Step 6 draft automatically. Clear a model only when you want its saved allow list to remain unchanged. Use a short range first; expand the range only when representative tagged data is missing.

### Review acceleration

Macro discovery and data-model acceleration are separate checks. Use the readiness links in Setup to open the applicable Data Models management page. A model can have a correct index allow list but still lack usable acceleration summaries.

## Data sources {#data-sources}

| Product area | Typical source types or data | Primary macro |
| --- | --- | --- |
| Catalyst Center | `cisco:dnac:*`, `cisco:catalyst:center:*` | `index_catalyst` |
| Firewall | `cisco:asa`, `cisco:ftd*`, `cisco:sfw:*`, `cisco:sourcefire:*`, `cisco:estreamer:*` | `index_firewall` |
| Identity | `cisco:ise:*`, Windows, and Active Directory | `index_identity`, `index_windows` |
| Network infrastructure | `cisco:ios*`, `cisco:telemetry`, and network syslog | `index_network` |
| Network detection | Zeek connection, DNS, TLS, HTTP, and notice logs | `index_zeek` |
| Meraki | `meraki:*` | `index_meraki` |
| Cisco Spaces | `cisco:spaces:*` | `index_spaces` |
| ThousandEyes | `cisco:thousandeyes:*` and TA data-model macros | `index_thousandeyes` |
| Intersight | `cisco:intersight:*` | `index_intersight` |
| Cisco SD-WAN | `cisco:sdwan:*` | `index_sdwan` |
| Data center | `cisco:dc:aci:*`, `cisco:dc:hyperfabric:*`, `cisco:dc:mds:*`, `cisco:dc:nd:*`, `cisco:dc:nexus9k*` | `index_dc` |
| Security stack | Cisco XDR, Umbrella, Secure Access, Secure Endpoint, Isovalent, Zscaler ZPA/ZIA, and related security sources | `index_security` |
| F5 BIG-IP | `f5:bigip:*` | `index_f5` |
| Duo | `cisco:duo:*` | `index_duo` |
| Cyber Vision | `cisco:cybervision:*` | `index_cybervision` |
| UCS | `cisco:ucs*` | `index_ucs` |
| Network Visibility Module | `cisco:nvm:*` | `index_nvm` |
| DHCP | Windows DHCP Server logs (`DhcpSrvLog`) and ISC DHCP logs (`dhcpd`) | `index_dhcp` |

Include all DC indexes in your local `index_dc` override. For example, a lab
using separate indexes can use `index IN (aci, hyperfabric, mds, nd, nexus)`;
preserve any additional indexes already configured for your deployment.
The shipped default remains customer-neutral.

The new Cisco networking catalogue searches select individual `resource_type`,
`dataset`/`endpoint_id`, or `component` schemas. Latest-observed tables describe
the selected time window, not a guaranteed complete current snapshot. Missing
measurements remain unknown, cumulative counters are not summed across polls,
and the dataset coverage table reports observed sources rather than inventing
healthy rows for missing feeds. Application inventory is not measured traffic;
MDS API-success summaries and collection configuration are not alarm or
throughput KPIs. Microburst peak and duration values retain vendor units.

Dashboard results depend on source types, normalized fields, data models, index mappings, permissions, and the selected time range. An empty result can mean that no matching condition occurred; it does not always indicate a collection failure.

## Dashboards {#dashboards}

Dashboard Manager opens and presents the supplied Dashboard Studio views. Most secure-networking story dashboards use six first-page KPI cards and move supporting tables and charts into in-dashboard investigations. The time picker controls the investigation window, and trend searches generally let `timechart` choose an automatic span. Forecasting, cadence, and interval-dependent calculations retain fixed spans where the math requires them.

### Secure-networking journeys

Secure-networking dashboards default to `-24h@h` through `now`, matching the **Last 24 hours** preset in the advanced time picker. The **24h** button uses the same range. The start is rounded down to the hour; saved or URL-supplied custom ranges retain their selected boundaries.

| Menu | Dashboards |
| --- | --- |
| Zero Trust Access | Zero Trust Posture; Authentication and Policy Enforcement; Policy Management; User Activity Monitoring; Detection & Response; Remote Access VPN Sessions and Posture |
| Secure Infrastructure | Infrastructure Posture; Secure Infrastructure Status; Secure Data Center Operations; SD-WAN and Network Health Monitoring |
| Scalable Network Segmentation | Segmentation Readiness; Segmentation Operations |
| Hybrid Mesh Firewalling | Hybrid Mesh Enforcement; Threat Detection and Enforcement; DLP and Cloud Native Security |
| Agentic Ops | Operational Intelligence; Secure Networking Assurance; Executive Assurance |

The **More** menu contains IT Health, NetOps Readiness, Security Resilience, Building Intelligence, Cisco Spaces Intelligence, Workplace Single Pane of Glass, Catalyst Health, Asset Inventory, operational views, Dashboard Manager, Search, Setup, and visual lab tools included in the installed profile.

### Dashboard actions

- **About this metric** explains the card's calculation, expected fields, interpretation, and related information.
- **Investigate drivers** opens supporting searches without loading every detail search on the first canvas.
- **Open in Search** opens the exact SPL with the active dashboard time range and allowed dashboard-defined filters.
- Dashboard Manager view controls support display options, zoom, export, and cloning for supported dashboards.

### Create a dashboard

The library has three tabs: **Included** contains supplied dashboards, **Yours** contains managed dashboards owned by you, and **Shared** contains managed dashboards shared in the app that you have permission to read, including other users' dashboards. A dashboard you own and share appears in both **Yours** and **Shared**. Existing app-owned dashboards appear in **Shared**. Private dashboards do not appear in **Shared**.

1. Open **More > Dashboard Manager** and select **Create New**.
2. Enter a title and optional description, then choose who can see the dashboard: **Private** (selected initially) or **Shared in App**. Share a ready dashboard in the app so colleagues can benefit; app sharing requires permission to publish dashboards in this app. You can start privately and change its permissions on Splunk's **Dashboards** page to share it later if your role permits. Select an **Absolute** or **Grid** layout.
3. Select **Create** once. The button shows **Creating…** while the request is in progress, and the editor opens when creation succeeds.

If the title produces an existing dashboard ID, choose a different title or cancel and open the existing dashboard to edit it. Creating a dashboard does not overwrite the existing one. Creation errors remain visible inside the dialog.

If the dashboard is saved but app sharing fails, select **Open saved dashboard** to continue with the saved dashboard. If the request cannot be confirmed, check the dashboard library before trying again. Other Dashboard Manager error notifications appear above open dialogs and previews and remain until dismissed.

## Insights Workspaces {#workspaces}

Map height defaults to **Match workspace** for new view preferences and after a factory reset. You can select **Compact** in **Dashboard controls > Map height**; saved personal choices are preserved across upgrades.

Insights Workspaces are reusable, audience-specific views of Searchbase-backed KPIs. A workspace combines header metadata, sections, default tiles, a Signal Rail, map settings, and presentation defaults. Built-in workspaces provide packaged starting points; custom workspaces store customer-specific choices without changing packaged definitions.

### Built-in workspaces

| Workspace | Initial focus |
| --- | --- |
| Secure Networking | All five secure-networking pillars |
| Zero Trust Access | Identity, infrastructure, and agentic operations |
| Network Resilience | Infrastructure, segmentation, firewalling, and agentic operations |
| Agentic Security Operations Center | DNS, firewall, network detection, and unified investigation |
| Security Operations | Security, IT health, and custom executive content |
| Executive Briefing | IT health, security, and building intelligence |

### Create a workspace {#workspaces-create-a-workspace}

You need the `ssne_manage_insights_workspaces` capability to create a shared workspace.

1. Open **Home**, select the workspace title, and select **Edit workspaces**.
2. Select **New**.
3. Enter a display name and a unique workspace ID. The ID must start with a letter and contain only lowercase letters, numbers, and underscores.
4. Under **Start from a template**, choose the catalogue and initial sections that match the audience. The template is only a starting point.
5. Set the default visible tiles per section, map placement, map presentation, header title, header subtitle, and at least one section.
6. Select **Save workspace**. The app opens the saved workspace for review.
7. Arrange the tiles and visible count in each section.
8. Select **Publish workspace layout** to save the shared section layout.
9. Select **Configure Signal Rail** to choose and order the shared KPI membership.

Test the workspace with a role that represents the intended audience before publishing it. Workspace management permission does not grant access to searches or indexed data.

### Duplicate, edit, and delete a workspace

- **Duplicate** copies the source workspace metadata, sections, shared layout, and Signal Rail into a new custom workspace.
- Editing a built-in workspace creates local overrides while preserving the packaged default definition.
- Built-in workspaces cannot be deleted. A workspace manager can delete a custom workspace.
- Deleting a custom workspace removes its shared local stanza and associated layout. It does not delete Searchbase definitions or indexed data.

### Add and publish searches {#workspaces-add-and-publish-searches}

- **Add for me** adds a private tile to the current user's browser-scoped workspace view.
- **Add for everyone** adds a shared tile to the workspace layout and requires workspace-management permission.

The picker opens in **Suggested** scope with searches from `splunk-cisco-dashboards` that match the active section. Select **Entire catalogue** to browse compatible searches from other installed Searchbase providers. The app filter still starts with only `splunk-cisco-dashboards` selected. Searches already configured in the section remain hidden unless the user chooses to show added searches.

**SGT assignment coverage:** The Secure Networking workspace includes `secure_networking_sgt_assignment_coverage_trend` in Scalable Network Segmentation, replacing SGACL Enforcement Activity Trend. Select **View coverage by site/device** to open `secure_networking_sgt_assignment_coverage_by_site_device`. Coverage is the percentage of successful ISE authentication events with one usable, non-default SGT. Missing, default, and conflicting tag values remain in the denominator; the selected-window percentage is weighted by event count. Repeated authentications count repeatedly, so this measures reported authentication coverage rather than distinct endpoints or SGACL enforcement. An empty window reports no observations, with no coverage percentage. The detail retains missing or ambiguous site/device context and returns at most 1,000 groups; `TotalGroups` and `DetailRowsTruncated` indicate additional groups. Existing shared or personal layout overrides retain their saved tiles; a workspace manager can replace the old tile and publish the layout to adopt this change.

### Configure the Signal Rail

Signal Rail membership and order are shared workspace configuration. Speed, density, and KPI text size are per-user preferences. Signal Rail searches are prioritized during initial loading. The Agentic Security Operations Center workspace also avoids dispatching searches from collapsed sections and supports a personal one-to-four concurrent-search setting.

Workspace searches default to two simultaneous requests per page. When Splunk explicitly reports that search slots are exhausted, the page pauses new tile requests and retries with increasing, randomized delays, for at most four attempts per search. A server-provided retry delay is honored up to 30 seconds. If capacity remains unavailable, affected tiles show **search slots busy** instead of treating the rejection as an empty result. Wait for running searches to finish, then refresh. Other tabs and users share the server's limits; this page-level queue does not increase Splunk capacity or coordinate all sessions. Ask the administrator to review per-user, role and platform capacity for the expected simultaneous demo load.

### Explore the operational search library

Searchbase includes twelve additional searches for data quality, certificate lifecycle, MDS/SAN, and Hyperfabric. Search for **Networking Data**, **ISE - Repeated**, **Zeek - Observed Certificate**, **Zeek - Certificate Rotation**, **MDS**, or **Hyperfabric** in the catalogue. These searches do not add workspace tiles, schedule jobs, or enable collection automatically.

A second set adds twelve optional investigations. Search for **ASA and FTD**, **FMC - Observed NAT**, **FMC - Low-Activity**, **Duo - Repeated Denials**, **Duo - Push**, **CIM Authentication - Password Spray**, **IOS - Link State**, **IOS - Routing Adjacency**, **Catalyst Center - First Active Issues**, or **Cross-Vendor Traffic**.

- **Firewall operations:** Inspect explicit NAT/resource-limit messages, observed NAT tuple concentration, and rules seen in five or fewer connection records. These require the documented ASA/FTD syslog or FMC/eStreamer fields. Traffic records cannot identify never-used or shadowed rules, measure appliance capacity headroom, or justify removing a rule. Translation creation failures are not automatically pool exhaustion.
- **Identity sequences:** Find at least three Duo denials before success within ten minutes, five denied/fraud push events in a fifteen-minute bucket, or CIM authentication sources with at least ten failures across five users in fifteen minutes. These editable thresholds identify investigation candidates. Duo events are deduplicated by usable transaction ID or event hash, with conflicting identities excluded; equal timestamps do not establish earlier ordering. The password-spray search requires the CIM Authentication model and follows `scd_summariesonly`.
- **Change-impact candidates:** Review IOS link or BGP/OSPF messages within fifteen minutes after observed configuration activity, or first selected-window active Catalyst Center issues after administrative audit activity. Correlation requires the same reporting host; Catalyst Center also requires an exact device ID on both feeds. Repeated issue polls cannot create a new post-audit issue. Temporal association does not prove cause, disruption, or a successful change.
- **Cross-vendor and IPv6 visibility:** Compare observed IPv4/IPv6 record mix, IPv6-involved denied destinations, and address/decision field coverage across supported FTD/eStreamer, Palo Alto traffic, Zeek connection, and Zscaler ZIA feeds. Only explicit vendor actions establish allow/deny decisions; Zeek connection state and TCP reset alone do not. Unknown decisions and invalid addresses remain in coverage denominators. These are record counts, not unique sessions or comparable vendor traffic totals.

All twelve investigations return at most 1,000 groups, with `TotalGroups` and `RowsTruncated` indicating omitted groups. Use a finite window and start short on busy systems, especially for searches that order events. Streamstats history limits can undercount high-volume sequences. A no-observation result can reflect missing source fields, index routing, permissions, the data model, or unmet thresholds; it is not a healthy-state verdict. These additions do not change workspace layouts, schedules, index macros, or collection settings.

- **Data quality:** Compare event time with index time, inspect fifteen-minute feed bucket occupancy, or find repeated/conflicting ISE policy scalar values. Start raw-event delay searches with a short finite window on busy deployments. Bucket occupancy is not collector uptime, and completely unobserved feeds need an expected-source inventory to detect them.
- **Certificates:** Review expiry detail, lifecycle bands, and subjects with multiple fingerprints. Requires `zeek:x509` observations through `index_zeek`. Expiry is evaluated against the current clock; records without usable fingerprints are excluded, and missing or conflicting validity remains unknown. Multiple fingerprints suggest a rotation investigation, not proof of successful renewal or deployment.
- **MDS/SAN:** Review sampled transmit-wait and CPU/memory trends or repeated transmit wait of at least 10% in two fifteen-minute buckets. The editable 10% threshold is for investigation. Sampled bucket counts do not measure continuous congestion duration.
- **Hyperfabric:** Review observed port-rate trends, latest directional imbalance, and rate-field completeness. Rates are Mbps, not link utilization. Directional traffic can be normal. Missing directions remain unknown; valid zero rates mean idle only when both directions are present. Coverage includes observed counter identities, without assuming inventory IDs equal performance port indexes.

Table searches return at most 1,000 groups and expose `TotalGroups` and `RowsTruncated` where applicable. Empty output guidance does not establish that the environment is healthy. The existing index macros and the user's role determine which sources are visible.

### Explore multivendor networking searches {#multivendor-search-library}

The catalogue includes **80 optional multivendor searches**: twenty vendor-neutral investigations and six each for ten vendor ecosystems. In **Add search**, select **Entire catalogue**, enable **Show table searches** and **Show drill-down searches**, and search by the prefixes below. Review each entry's source contract and interpretation guidance in Searchbase before adding it to a workspace.

CrowdStrike connection, blocked-network and listener searches choose the first valid textual address matching the event's IPv4 or IPv6 family. Invalid or wrong-family aliases cannot hide a valid later address. Unspecified listener bind addresses (`0.0.0.0` and `::`) remain valid; raw integer-encoded addresses still require add-on normalization.

Port, HTTP response-code, byte-count and interface-counter measurements require whole numbers within the ranges documented in each search. Each alias is validated before fallback; a valid preferred value keeps precedence. Fractional timing and signal measurements remain valid. Invalid interface reset or uptime values remain unknown and contribute to `ContinuityUnverifiedIntervals`.

| Search prefix | Investigations and input requirements |
| --- | --- |
| **Network Essentials** (20) | Traffic/application records, explicit decisions, destination/port fan-out, remote-administration ports, durations, authentication outcomes/source diversity/method visibility, DNS outcomes/query types/latency, HTTP errors/cleartext destinations, intrusion actions, change failures, IPv6 decision visibility, and IF-MIB interface error rates. Nineteen use CIM tags and normalized fields; interface rates require flattened IF-MIB counter samples. No Cisco source or companion model is required. |
| **Palo Alto** (6) | Terminal application bytes, denied zone/rule boundaries, GlobalProtect failures, threat actions, terminal-session reasons and HA system messages. Requires the matching PAN traffic, GlobalProtect, threat and system feeds with their parsed fields. |
| **Fortinet** (6) | VDOM policy denials, VPN transition messages, SD-WAN probe measurements, IPS actions, configuration audit paths and reported application risk. Supports `fgt_*`, `fortinet_*` and `fortigate_*` traffic/event/UTM families; verify the names and fields used by the deployed add-on. |
| **Juniper / Aruba** (6) | Four **Juniper** searches inspect SRX denied/closed flows, BGP state messages and commit activity. Two **Aruba** searches inspect access-authentication failures and client SNR. Junos, Aruba/ClearPass authentication and flattened Central client metrics are separate contracts; Junos syslog alone does not provide Aruba client measurements. |
| **Arista** (6) | Interface error/discard/octet counter rates, latest observed interface state, BGP adjacency messages and LANZ queue measurements. Counter/state searches need flattened metric snapshots; LANZ needs an event exporter. EOS syslog alone does not supply these measurements. |
| **Check Point** (6) | Denied services, VPN failures, IPS signatures, policy-install audit messages, observed NAT pairs and rule-action inventory. Requires the chosen Log Exporter parser and the appropriate traffic, blade or management-audit fields. Both `cp_log:syslog` and legacy `cp_log` are recognized. The older Splunk Log Exporter add-on is archived; confirm a suitable ingestion/parser route for the deployment. |
| **F5** (6) | Pool-member monitor messages, HTTP response errors, ASM blocked violations, APM policy denials, TLS handshake failures and HA role messages. Requires the corresponding BIG-IP syslog, iRule, ASM or APM logging formats. |
| **Zscaler** (6) | ZIA HTTP errors and request/response sizes; ZPA server-setup measurements, user public-IP diversity, private-IP field visibility and double-encryption labels. Requires the selected NSS/LSS feeds and fields. Connection status and encryption labels do not independently establish policy allowance or end-to-end protection. |
| **Infoblox** (6) | NXDOMAIN and SERVFAIL evidence, threat-protection actions, query-name diversity, TXT/NULL activity and DHCPv4 NAK messages. Requires the corresponding DNS response, threat or DHCP feeds. Historical query-only DNS mappings cannot establish response outcomes. |
| **CrowdStrike** (6) | Process/destination context, blocked-network evidence, DNS-name diversity, IPv6 destinations, listener ports and containment completion activity. Requires the relevant Falcon FDR sensor event families; detections alone are insufficient. Process context uses agent plus stable sensor process identifiers and retains missing/conflicting rollup context. |
| **Microsoft Defender** (6) | Process network events, connection failures, Network Protection blocks, remote-administration ports, public-destination fan-out and remote-session process activity. Requires exported advanced-hunting events. Direct rows and nested `properties` fields are supported; Network Protection blocks can arrive in DeviceEvents rather than DeviceNetworkEvents. |

These searches use the existing network, firewall, security, F5 and Windows index macros. An administrator must include the actual source indexes in those scopes; adding a catalogue entry does not change routing, install an add-on, enable collection or grant access. CIM searches use event tags and field normalization without requiring accelerated data models.

Start with a short, finite window on busy systems. Each search returns at most 1,000 groups and exposes `TotalGroups` and `RowsTruncated`. Missing/conflicting values remain unknown. Counts describe observations or explicitly labeled valid measurement intervals, rather than unique sessions, incidents, current states or outages. Counter rates require successive samples for the same device/interface; counter decreases, reported discontinuities/uptime decreases, missing/conflicting snapshots, intervals over one hour and counters beyond exact integer precision are excluded. `ContinuityUnverifiedIntervals` flags missing discontinuity/uptime context; a reset that occurs and recovers between observations can still affect rates. Rates are not link utilization or packet-loss percentages. LANZ queue and ZPA setup measurements retain source units where stated; verify exporter units before comparison.

The definitions do not automatically add tiles or schedule searches. The result cap bounds returned rows, not scanned events or grouping memory; qualify high-volume deployments using short representative windows. A tested query is not proof that a particular vendor feed is populated or fully qualified. True unused/shadowed-rule analysis and appliance capacity headroom still require configuration inventory and capacity counters.

### Where workspace settings are saved {#workspaces-where-settings-are-saved}

| Scope | What is saved | Location and behavior |
| --- | --- | --- |
| Shared workspace | Metadata, sections, header, map defaults, shared tile layout, shared additions, and Signal Rail membership | `local/insights_workspaces.conf`; visible to every viewer and preserved as local configuration during upgrades |
| Shared topology | Sites, links, telemetry bindings, map defaults, and shared section titles | `local/customer_topology.conf`; saved through the protected topology endpoint |
| Account preference | Signal Rail speed, density, and text size | `insights_workspace_preferences.conf` in the signed-in user's Splunk namespace, with browser storage only as a fallback when the endpoint is unavailable |
| Browser preference | Personal sections, tile order and count, hidden tiles, private additions, section presentation, chart display, map split and height, search concurrency, appearance, and last workspace | User-scoped browser local storage for the current account, workspace, browser profile, and Splunk Web origin; the last workspace also has a first-party cookie fallback |
| Current session | Focused section, active tile page, show-all state, and unsaved editor changes | Memory only; reloading the page discards these states |

Clearing browser storage can remove personal browser preferences and unpublished changes. It does not remove shared configuration files.

### Workspace permissions by role and capability {#workspaces-workspace-permissions-by-role-and-capability}

| Action | `user` or other role | `power` | Delegated custom role | `admin` or `sc_admin` |
| --- | --- | --- | --- | --- |
| Open workspaces and run permitted searches | Allowed | Allowed | Allowed | Allowed |
| Keep personal layout and display preferences | Allowed | Allowed | Allowed | Allowed |
| Create, edit, duplicate, or delete shared workspaces | Not allowed | Not allowed | Allowed | Allowed |
| Publish shared layouts, sections, and Signal Rail membership | Not allowed | Not allowed | Allowed | Allowed |
| Edit shared customer topology | Not allowed | Not allowed | Allowed | Allowed |
| Replace a factory tile's Searchbase or shared thresholds | Not allowed | Not allowed | Not allowed | Allowed |

The app grants `ssne_manage_insights_workspaces` to the exact `admin` and `sc_admin` roles by default. The built-in `user` and `power` roles do not receive it. Assign that capability to a custom role only when its members must manage shared workspaces and topology. `admin_all_objects` alone does not open Workspace Manager, and the delegated app capability does not permit factory `searchbase.conf` changes. If the current-user context cannot be read, the app denies shared and factory changes.

Workspace permission does not grant access to indexed data. Each viewer still needs the `search` capability, index permissions, data-model access, and knowledge object permissions required by the tile.

### Reset behavior

- **Reset tile** clears the current user's display override for that tile.
- **Reset workspace to factory defaults** on a built-in workspace removes app-local workspace and factory tile overrides and clears the current user's preferences for that workspace.
- A factory reset does not change another workspace or delete indexed data.

## Site connectivity {#site-connectivity}

The topology editor controls the workspace map title, subtitle, center, zoom, sites, links, roles, circuit capacity, and telemetry bindings. Shared topology is saved in `local/customer_topology.conf` through a capability-protected endpoint.

1. Open a workspace that displays the map and open the topology editor.
2. Set the map title and subtitle.
3. Move the map to the intended center and zoom, then select **Use current view**, or enter the values directly.
4. Add or edit sites with explicit coordinates.
5. Add links and select the matching ThousandEyes agent-to-agent test when available.
6. Save the topology.

The editor first checks its offline city list. For an unmatched site, enter explicit coordinates. Customer site text is never sent to a public geocoder. A bound ThousandEyes test can retain its permalink or construct a link from the test and account IDs. Keep the Leaflet and active map-provider credits available through **Map credits**.

## Supporting assets {#lookups}

| Asset | Purpose |
| --- | --- |
| `default/searchbase.conf` | Authoritative catalogue of named searches, metadata, explanations, drilldowns, and visualization options |
| `default/insights_workspaces.conf` | Packaged workspace, layout, Signal Rail, and signal-item definitions |
| `local/insights_workspaces.conf` | Customer shared workspace and layout overrides |
| `local/customer_topology.conf` | Customer shared map, site, link, and topology settings |
| `site_topology_lookup.csv` | Catalyst Center site-name enrichment used by client and device panels |
| `scd_summariesonly` | Controls accelerated-summary behavior for eligible `tstats` searches |
| `spaces_hierarchy(1)` | Normalizes Cisco Spaces hierarchy fields |
| `dnac_site_normalize(1)` | Normalizes Catalyst Center site labels |

Searchbase definitions are app-managed factory content. Workspace managers choose and arrange those definitions but cannot rewrite factory searches unless they also have the required administrative access.

## Operations {#operations}

- Start investigations with a narrow time range and expand it only when required.
- Re-run Configure data after onboarding a source or moving Cisco data between indexes.
- Monitor acceleration health for data-model-backed searches.
- Use **Open in Search** to distinguish no matching events from missing fields, permissions, or collection.
- Test shared workspaces with representative user roles after permission or knowledge-object changes.
- Keep customer configuration in `local` and preserve it through the deployment process.
- Use the installed version and build shown in the app header when opening a support case.

### Plan search capacity for shared demos

Count active sessions and the searches they run together, rather than provisioned accounts. The workspace's two-request default applies to one page; other tabs, dashboards, and users can consume the same server resources. Review effective per-user limits, any enforced cumulative role limits, and overall stack capacity with the Splunk administrator before increasing quotas. Raising a quota does not add compute capacity.

For integrations that assign a demo account at launch, confirm whether the account is reserved exclusively for that session and when it can be reused. Sessions sharing a Splunk identity can compete against that identity's search limit. Do not assume that a large account pool provides an equal number of simultaneous search slots.

### Diagnose integrated sign-in and navigation

A SAML sign-in can succeed while additional Cisco Cloud Control identity or navigation requests fail. When reporting an integration issue, include the launch path, installed app version/build, account type and role, time of failure, and the failing service's status and error text. Compare the app with a standard Splunk page under the same login to help identify the affected component. Remove session tokens and credentials from any evidence you share.

Ask the identity or integration owner to investigate token-exchange failures, service authorization errors, and cross-origin request failures. An app upgrade does not by itself change identity-provider settings, service permissions, browser cross-origin policy, or Splunk search quotas.

## Troubleshooting {#troubleshooting}

| Symptom | First checks |
| --- | --- |
| A panel is empty | Confirm the time range, run Configure data, verify the macro, then open the panel in Search. |
| A search is slow | Narrow broad macro definitions, shorten the time range, and inspect data-model acceleration. |
| A tile reports search slots busy | Wait for running searches to finish, then refresh. Reduce the personal simultaneous-search setting and close unused demo tabs. Ask the administrator to review search concurrency limits and stack capacity if this persists. |
| A tile reports search failed | Open the tile's search in Splunk Search and inspect its error, permissions, and required macros, lookups, models, or commands. A failed search is not an empty result. |
| Typing r or t in an embedded assistant refreshes the workspace or changes time | Confirm that version 1.0.70 or later is installed, refresh the page, and retest the actual assistant editor. If it persists, report the installed build and affected editor to the app owner. |
| Workspace r and t shortcuts do nothing after clicking the dashboard background | Upgrade to version 1.0.80 or later and refresh the page. In earlier versions, moving focus to a workspace control with Tab can restore the shortcuts. Shortcuts intentionally stay inactive while typing in an assistant or text field. |
| Splunk opens, but Cisco Cloud Control fails to load | Capture the failing request's status and error text without tokens. Compare a standard Splunk page under the same login and contact the identity or integration owner; successful SAML login does not confirm every connected service is available. |
| A CIM panel is empty | Confirm tags, event types, CIM index macros, model permissions, required fields, and acceleration. |
| A Cisco model search is empty | Confirm the companion app, model root and child datasets, source types, and model fields. |
| Setup discovery takes too long | Use a shorter representative range. CIM discovery reports each model independently and can be canceled without losing completed results. |
| Setup cannot finish | Return to Configure data after a failed routing scan, or choose Balanced mode when accelerated-only prerequisites are incomplete. |
| A workspace cannot be saved | Confirm `ssne_manage_insights_workspaces`, then inspect the bounded REST error returned by Splunk Enterprise. |
| A dashboard cannot be created | Read the error inside the Create dialog. For an existing dashboard ID, choose a different title or open the existing dashboard to edit it. If the request cannot be confirmed, check the library before retrying. |
| A dashboard was saved but sharing failed | Select **Open saved dashboard** and check the reported sharing error and your permissions before changing its sharing settings. |
| A personal layout disappeared | Check whether browser storage or cookies were cleared. Publish layouts that must be shared. |
| A duplicated workspace has unexpected content | Confirm the source workspace, shared layout, and Signal Rail before saving the copy. |
| Site names or links are missing | Verify topology configuration, coordinates, lookup data, ThousandEyes bindings, and data permissions. |
| A field projection changes search behavior | Open the search and disable search optimization for a pipeline affected by optimizer field pruning. |
| New JavaScript or dashboard definitions do not appear | Refresh Splunk Web. Ask the Splunk administrator whether the deployment process requires a restart after endpoint changes. |
| A new release has no Update link | Confirm the installed app version, **Check for Updates**, and the release's compatibility with your Splunk platform version. Ask your administrator to check Splunkbase connectivity and the app update-check interval. A release appearing on Splunkbase does not by itself confirm that the instance has discovered it. |

## What's New / Release Notes {#release-notes}

This Markdown file is the authoritative source for the in-product release history.

::: release Release Notes | October 2026 - Version 1.0.80

### Insights Workspaces

- Made **Match workspace** the factory default for map height. Saved personal height preferences remain unchanged, and factory reset restores the new default.
- Restored `r` (refresh) and `t` (cycle time range) when the surrounding Splunk dashboard panel has focus after clicking the workspace background. Typing in Cisco Cloud Control assistants and other text editors remains protected from workspace shortcuts.
- Fixed ISE policy-family activity showing zero when policy snapshots contain repeated multivalue identifiers or counters. Equal values are normalized before grouping and hit-counter calculations; conflicting values and invalid counters are excluded instead of creating misleading activity.
- Replaced SGACL Enforcement Activity Trend in the default Secure Networking workspace with SGT Assignment Coverage and its site/device drilldown. The new searches measure event-weighted SGT coverage for successful ISE authentications, retain missing and conflicting tag context, and distinguish empty windows from zero coverage. The workspace keeps nine tiles per section; saved layout overrides and other workspaces are preserved.
- Added twelve catalogue searches covering ingestion delay and feed quality, observed certificate expiry and rotation candidates, MDS/SAN observation trends and recurrence, and Hyperfabric port-rate trends, directionality and measurement coverage. Missing measurements remain distinct from zero; workspace layouts and collection settings are unchanged.
- Added twelve more optional catalogue investigations for firewall NAT/resource-limit evidence and observed rule activity, Duo/CIM authentication candidates, IOS/Catalyst Center change-impact associations, and cross-vendor IPv6 and decision-field visibility. Documented thresholds, source requirements, unknown observations and the limits of traffic-only capacity/rule conclusions; existing workspace layouts remain unchanged.
- Added eighty optional networking investigations: twenty vendor-neutral CIM/IF-MIB searches and six each for Palo Alto, Fortinet, Juniper/Aruba, Arista, Check Point, F5, Zscaler, Infoblox, CrowdStrike and Microsoft Defender. Added explicit source/field contracts, current/legacy field variants, bounded results, duplicate/conflict handling, counter-reset safeguards and endpoint process-context checks. Documented feed prerequisites and interpretation limits without changing collection, schedules, routing or workspace layouts.
- Fixed CrowdStrike address fallback so invalid or wrong-family aliases no longer hide valid IPv4/IPv6 connection, blocked-network or listener addresses. Preserved valid unspecified listener binds and explicit missing-address guidance.
- Hardened thirteen multivendor searches to reject fractional or out-of-range ports, HTTP codes, byte counts and counters before alias selection. Invalid reset/uptime context now remains explicitly unverified, while fractional timing measurements remain valid. Corrected the Aruba authentication source reference.

:::

::: release Release Notes | October 2026 - Version 1.0.70

- Removed the Beta label from the app name and navigation labels.
- **Search quota assessment:** Searchbase now includes Search Quota Impact by Cloud Label, separating disk, user, role, and instance limits, normalizing MB measurements, and preserving missing telemetry. Select the desired assessment period in the time picker; labels use the latest 15 minutes of introspection data.

Release preparation is in progress. Final package/security review, publication, and integrated-cloud validation are pending.

### Insights Workspaces

- Fixed workspace shortcuts intercepting text entered in the Cisco Cloud Control assistant and other embedded editors. Typing keeps its letters, and workspace shortcuts remain available from the workspace and unfocused page background.
- Added a shared page-level pause and bounded retries when Splunk rejects searches because concurrent-search slots are exhausted. Affected tiles distinguish **search slots busy** from empty results after retries are exhausted; other dispatch and job failures now report **search failed**. Server quotas and permissions remain under administrator control.

### Setup

- Restored **Refresh status** and the last-checked time in the current **Configure data** step, so acceleration can be checked again without leaving setup or saving the draft plan. The check confirms that acceleration is enabled; summary building may still be in progress.

### Dashboard Manager

- Aligned the default and **24h** shortcut on the 18 Secure Networking dashboards with the advanced time picker's **Last 24 hours** preset (`-24h@h` through `now`). Custom ranges remain unchanged.
- Chart-library debug messages are quiet during normal use. To troubleshoot, add `canvasDebug=1` to the page URL query, before any `#` fragment, and enable the browser console's debug/verbose level. Remove the parameter to disable diagnostics. Warnings and errors remain visible. Diagnostic output can contain chart data; review it before sharing logs.
- Dashboard Manager hides unavailable KPI comparisons when fewer than two valid numeric trend samples exist, including inherited default trends on null or timestamp-only results. Headline values remain unchanged, and unavailable headline colors use the theme default. Constant line and area series receive finite axis bounds; time-based charts omit rows without a valid time coordinate from rendering. Tables and searches keep their original records, and charts add no synthetic samples.
- Extended finite-axis handling to inherited chart series and empty numeric domains, covering affected NetOps Readiness, Data Center runtime, and Spaces capacity views. Removed deprecated iteration calls in the packaged chart adapter used by Building Intelligence.

- Fixed focus after leaving a fullscreen visualization opened with the keyboard or mouse: focus returns to that panel's native **Fullscreen** button, keeping keyboard navigation in context even when the toolbar was hidden.
- Fixed native Studio conversion for older and Searchbase-backed dashboards: copied searches keep their SPL and time range, native time pickers no longer leave unresolved span parameters, and saved conversions appear in Splunk's dashboard list with native editing enabled. Convert remains available for partially converted copies. The dialog explains that Manager-only investigation controls are removed and that required macros, lookups, commands, and data must still exist.
- Matched the native Dashboard Studio panel toolbar order: **Open in Search**, **Inspect**, **Fullscreen**, **Refresh**, **Add to AI Canvas**, and **Export**. Inspect opens the running search job. On eligible Cisco Cloud Control integrations, AI Canvas supports native and Searchbase-backed panels, carries their resolved search and time range with a bounded result preview, and offers new or existing canvases. Canvas availability and access remain controlled by Splunk and Cisco Cloud Control.

### Upgrade and integration notes

- After upgrading, confirm the installed version/build and test with a representative restricted user, including typing in the actual embedded assistant. Local verification does not establish integrated-cloud behavior.
- Added shared-demo capacity and sign-in troubleshooting guidance. Workspace retries do not increase per-user, role, or stack limits; administrators must size and test expected simultaneous usage.
- Integrated-cloud AI Canvas creation and cross-launch, restricted-user sharing, and saved CSV export contents still require final release qualification. Cloud Control identity/navigation errors remain under investigation; this release does not claim to resolve them.
:::

::: release Release Notes | October 2026 - Version 1.0.60
### Setup

- Added a clear **Refresh status** action and last-checked time for data-model acceleration. Clarified that Splunk can still be building summaries after acceleration is enabled.

### Dashboard Manager

- Added **Sharing** to dashboard cards and the library table so users can see **Private**, **App**, or **All apps** at a glance. Labels refresh after a permission change.
- Added **Permissions** to dashboard cards and table rows. Owners with the required Splunk permissions can promote a private dashboard to **Shared in App** or make it private again without leaving Dashboard Manager. The dialog checks current permissions and preserves ownership and existing edit access.
- Defaulted new dashboards to **Private**, matching standard Splunk creation and avoiding an automatic app-sharing request for users without sharing permission.
- Kept both visibility choices visible, encouraged app sharing for dashboards ready for colleagues, and explained how to share a private dashboard later. Reset the creation dialog to **Private** each time it is reopened.
:::

::: release Release Notes | September 2026 - Version 1.0.55
### Zscaler Zero Trust Access

- Added eight Zscaler searches for data coverage, private application access, policy and connection reasons, unreachable applications, connection-status trends, ZIA enforcement outcomes, blocked web activity, and named web threats.
- Distinguished repeated ZPA log records from distinct connection IDs and kept normal connection closures separate from explicit reachability failures.
- Used the configurable security index scope and documented the required Zscaler add-on fields and interpretation limits.
- Fixed Setup discovery to find Zscaler feeds outside existing index scopes and propose their indexes for `index_security`; administrators review and save the routing change.
- Added recommended placement in existing ZTA dashboards to each Zscaler search description, including guidance for complementary ZPA panels on the remote-access dashboard.
- Added Zscaler investigations to relevant cards across all six ZTA dashboards, preserving the six-card layouts and existing investigation choices. Labeled the Zscaler views as separate source detail.

### Insights Workspaces

- Restored the update badge beside the installed version when Splunk reports a newer app release.

### Dashboard Manager

- Added a **Shared** library tab to find dashboards shared in the app, including dashboards created by other users.
- Kept new shared dashboards associated with their creator so they also appear under **Yours**. Editing dashboard metadata preserves existing sharing permissions.
- Opened the linked Searchbase search from the dashboard data-source editor and improved dark-mode text and trend contrast.
- Set Searchbase app filters to this app by default while keeping other apps available to select.
:::

::: release Release Notes | September 2026 - Version 1.0.54
### Release overview

- Reduced the app package and JavaScript download sizes.
- Added troubleshooting guidance for app update notifications.

This maintenance release includes the Dashboard Manager reliability and visualization-spacing improvements introduced in version 1.0.53.
:::

::: release Release Notes | September 2026 - Version 1.0.53
### Dashboard Manager

- Prevented new dashboards from overwriting existing dashboard IDs or creating private copies that conflict when shared. Creation errors now remain visible in the dialog, duplicate submissions are blocked, and a saved dashboard can still be opened if sharing fails.
- Kept Dashboard Manager error notifications in front of open dialogs and previews until dismissed, with one notification host shared across the library and editor.
- Corrected Network Graph option types to eliminate repeated schema-validation warnings when opening Dashboard Manager and its editor, while preserving validation of graph settings.
- Preserved spacing between Dashboard Manager visualizations by sizing chart content to the space remaining beneath wrapped titles and descriptions.

### Map usability

- Prevented transparent site-marker padding from intercepting nearby link clicks, widened link selection targets, and added keyboard activation with visible focus for map links.

### Search performance

- Replaced raw FTD feed-freshness, WSA volume, SD-WAN audit volume, and total SSE event scans with indexed-metadata `tstats` searches.
- Added model-backed aggregation for ThousandEyes page completion and path-quality detail, plus Catalyst interface spike, drop, and asymmetry candidates. These searches require their companion models and honor the shared summary-coverage setting.
- Deferred display enrichment until after the existing result limits for SSE event detail and FTD anomalous sessions, preserving selection and thresholds.
:::

::: release Release Notes | September 2026 - Version 1.0.52
### Release overview

Version 1.0.52 preserves complete large-fleet asset inventories, advances release build allocation beyond the published 1.0.51 package, keeps first-run CIM discovery independent of saved allowlists, and keeps TA-owned Cisco routing definitions outside user-driven tuning.

- Made Insights and Dashboard Manager drill-downs use the workspace's navy, cyan, and purple atmosphere instead of a flat black panel, with a consistent dimmed backdrop instead of an ambiguous transparency slider.

- Moved the Site Roles, View, and Map credits controls into a dedicated rail below the topology viewport, so compact maps keep every site visible and the full map surface remains draggable.

### Workspace usability

- Kept tile information popovers concise on hover and focus, while clicking the same information control reveals the parent tile's complete Searchbase description, explanation, operator action, references, and execution plan.
- Kept the separate tile detail control dedicated to associated drill-down searches and each drill-down search's own metadata.
- Added responsive sizing, safe wrapping for long identifiers, viewport-bounded scrolling, pointer persistence, and Escape dismissal to tile information popovers.
- Prioritized Searchbase-bound topology link searches immediately after the Signal Rail, so live link status and ThousandEyes metrics populate without waiting behind ordinary dashboard sections.

### Asset inventory

- Removed the implicit 10,000-row limit from the **Asset Inventory - Build Lookup** saved search so fleets larger than Splunk's default `sort` limit are written completely to `asset_inventory.csv`.
- Removed the same implicit limit from the **Full Inventory** dashboard table so every row in the generated lookup remains available for display and filtering.
- Added regression coverage for both inventory paths.

### Guided Setup

- Fixed first-run CIM discovery so tagged events are found before a CIM index
  allowlist has been saved, including Umbrella DNS events in `cisco_umbrella`.
- Kept TA-owned Cisco DC Networking routing macros and the Cisco Enterprise
  Networking sourcetype allow-list outside the Setup tuning and save path so
  their static definitions remain managed by the owning TA.
- Grouped the final Settings to be saved review by target app so multiple
  macros and settings remain easy to scan without repeating the app name on
  every row.

### Searchbase catalogue

- Moved the executive **Threat sources** tile from a raw firewall-event scan to the accelerated CIM **Blocked Traffic** dataset. The tile keeps its selected-window distinct-source headline and source scope while avoiding the high-volume distributed-peer failures seen with the previous raw pipeline.
- Restored the missing Searchbase binding for the **Active TE alerts** workspace tile so its Major/Critical alert total, trend, and baseline dispatch with the rest of the IT Health section.
- Corrected Catalyst wireless protocol and SSID traffic charts so punctuation-bearing series names such as `802.11ax` are handled as fields instead of causing a templatized-search parse failure.
- Corrected the Cisco Spaces **Client health by site** chart so duplicate multivalue Catalyst health and site fields are scalarized before numeric filtering and site normalization, restoring the named per-site series instead of an anonymous aggregate.
- Corrected Catalyst client-health handling across IT Critical Systems and Cisco Spaces Network Impact: `-1` and zero-client records are treated as unavailable, single-value tiles show the latest valid score with its reported age, and trend/correlation charts exclude unavailable samples.
- Aligned the Security Resilience **Details & KPI Reference** narrative with the full dashboard section so its guidance remains on one line without an unnecessary scrollbar.
- Corrected dotted-field quoting in Cisco Spaces device counts, Meraki VPN peer status, and Catalyst client-experience aggregations so Dashboard Studio and Searchbase searches resolve their nested fields instead of returning empty metrics.
- Corrected first-time topology saves so a workspace without an existing map stanza uses the create endpoint directly instead of producing an expected 404 before retrying.
- Hardened topology editing against stale-tab overwrites and damaged shared configuration, blocked editing until the canonical map has loaded, preserved intentionally empty maps, and added confirmations for draft discard and factory reset.
- Added 31 validated searches to Splunkbase packages: Zeek SSH authentication pressure, wired NAC vendor-MAC review, eight SD-WAN security analyses, firewall NAT activity, Meraki blocked destinations, and 19 Cyber Vision asset, event, and syslog views.
- Kept searches without populated validation results or with unresolved macro, data-model, lookup, REST, token, or MLTK dependencies in developer packages until their source contracts can be verified.

### Packaging and release safety

- Recorded published build 2095 as the durable release-history floor so future packages allocate build 2096 or later even when earlier archives are absent from `dist/`.

### Upgrade notes

- After upgrading, run **Asset Inventory - Build Lookup** once or wait for its next scheduled execution to replace any previously truncated lookup.
- No data migration or Splunk restart is required.

::: release Release Notes | September 2026 - Version 1.0.51
### Release overview

Version 1.0.51 fixes shared Searchbase additions in Insights Workspaces.

### Workspace behavior

- Fixed **Add for everyone** so shared Searchbase additions remain in the workspace after a page reload and are available to every viewer.
- Retained validation and de-duplication for both persisted CSV values and in-memory search-reference arrays.

### Upgrade notes

- No data migration or Splunk restart is required.
- Shared searches added with an earlier affected version must be added again after upgrading because the empty saved references cannot be reconstructed.

::: release Release Notes | September 2026 - Version 1.0.50
### Release overview

Version 1.0.50 simplifies topology link telemetry configuration, strengthens topology-save reliability, and adds reusable property-operations searches.

### Workspace and dashboard behavior

- Replaced the simultaneous Searchbase and ThousandEyes A2A link controls with one explicit **Telemetry source** choice.
- Kept the telemetry-source options visibly circular and consistently sized at every editor width.
- Show only the active setup path: select a reusable Searchbase search, or select an observed ThousandEyes A2A test directly and optionally narrow it by source and target agent.
- Prioritize the A2A inventory immediately after the signal rail so the direct test list is ready without waiting for every dashboard section to load.
- Removed internal A2A confidence percentages from author-facing choices and clarified the inventory and selection guidance.
- Fixed false stale-edit conflicts when saving topology Searchbase bindings and retained the saved selection after reopening or reloading a workspace.

### Property operations and inventory

- Added reusable AKIPS searches for device availability, inventory location, interface saturation, and interface-error hotspots.
- Added Catalyst Center property views for active issues and client experience, including health, RSSI, onboarding time, and poor-client counts.
- Added Cisco IQ lifecycle-risk views and enriched the unified device inventory with AKIPS location, lifecycle findings, and explainable critical or non-critical classification.
- Kept the searches customer-neutral: no customer index, property, or workspace name is hard-coded, and missing locations remain visible as **Unmapped**.

### Packaging and release safety

- Preserved the verified build-2089 release floor in tracked release history so removing local package artifacts cannot cause a later Splunkbase build number to decrease.

### Accessibility

- Grouped the telemetry choice as a labeled radio control and connected the ThousandEyes selectors to concise instructions.
:::

::: release Release Notes | September 2026 - Version 1.0.49
### Release overview

Version 1.0.49 expands secure-networking coverage, repairs workspace and setup reliability, improves accessibility and theme consistency, and strengthens the Splunkbase release path.

### Highlights

- **Secure Data Center Operations:** added a focused dashboard for ACI fabric health, critical faults, capacity, interface anomalies, policy enforcement, Secure Firewall IPS, Isovalent runtime security, and change intelligence.
- Added **About this metric** and **Investigate drivers** actions to every Secure Data Center Operations story card.
- Standardized the secure-networking Dashboard Studio experience around compact story cards, shared searches, on-demand investigations, and adaptive time ranges.
- Dashboard Manager now makes Edit visible immediately after same-tab edit-route changes. Searchbase pickers start with compact rows and let users reveal full metadata on demand.
- Added and refined built-in Insights Workspaces for secure networking, zero trust, network resilience, security operations, executive briefing, and the Agentic Security Operations Center.
- Fixed custom workspace creation and duplication, including shared layouts, section choices, and Signal Rail membership.
- Added readable light and dark appearance across workspace editors, map controls, drawers, fields, notifications, and Setup.
- Kept the installed app version and build visible in the workspace header and moved required Leaflet and basemap attribution into **Map credits**.

### Setup and data readiness

- Changed CIM discovery to one bounded search per data model, with two searches in flight, visible progress, cancellation, and preservation of completed results.
- Added an explicit **Skip CIM tuning** path when no CIM model is selected.
- Added Cisco Security and Cisco Intersight data-model discovery and readiness coverage while retaining raw searches where vendor model fields cannot preserve the required meaning.
- Applied CIM-first search selection where compatible and retained Cisco app or add-on models for vendor-specific fields.
- Updated operational timecharts to follow the selected range automatically while preserving fixed spans for forecasts, cadence analysis, and interval-dependent calculations.
- Added self-contained native statistical baselines for IOS-XR CPU and interface-error anomaly searches.

### Workspace and dashboard behavior

- Added shared workspace management through the `ssne_manage_insights_workspaces` capability for `admin`, `sc_admin`, and deliberately delegated custom roles.
- Kept built-in `user` and `power` roles read-only for shared workspace, topology, and background configuration while preserving personal preferences.
- Added **Add for me** and **Add for everyone** tile visibility choices.
- Add search now opens and resets with only this app selected. Entire catalogue remains available for searches from other installed apps.
- Added configurable Signal Rails, search concurrency, map placement, map height, tile density, typography, section focus, and shared publishing.
- Agentic SOC section headers no longer expose actions that targeted the development-only Searchbase Canvas. Splunkbase packages omit its customer-inaccessible resources, while explicit developer builds retain the internal surface.
- Open in Search accepts only dashboard-defined safe filter values.
- Custom Insights workspaces can now be created through the bounded persistence endpoint, and template choices retain circular radio controls.
- Topology Searchbase bindings now save without false stale-edit conflicts and remain selected after reopening or reloading a workspace.
- Insights workspace editors, drawers, map controls, Signal Rail controls, topology actions, and Setup retain readable Splunk UI colors in both appearances.

### Accessibility, security, and delivery

- Topology palette items and key manager/KPI dialogs now support complete keyboard operation. Workspace layers also restore focus when they close.
- Improved non-color selection cues, focus indicators, control labels, and responsive light and dark contrast.
- Removed public geocoding of customer site text; site placement uses an offline city list or explicit coordinates.
- Shared workspace and bounded Dashboard Builder background management support narrow capability delegation.
- **Dependency security:** patched published npm advisories by upgrading DOMPurify, fast-uri, source-map-js, postcss-selector-parser, and brace-expansion; removing sprintf-js from ESLint's dependency tree; and retaining the MapLibre GL JS XSS remediation, while ensuring Splunk visualizations continue to compile. A maintained local security patch mitigates the build-time braces stack-exhaustion advisory by rejecting brace/parenthesis nesting and AST traversal beyond 100 levels. Installation automatically applies the patch and fails if it cannot be applied; Dependabot may still flag the upstream version until a patched release is published.
- `build.sh --install` and `--deploy` use the SplunkBase profile by default. Use `--developer` only when internal development resources are required; the explicit `--fast` workflow remains developer-only.
- SplunkBase build, install, deploy, and remote-install workflows share one clean-source packaging path and apply the exact release-eligible archive.
- A successful SplunkBase install creates one upload-ready archive; the target's installed build does not affect package allocation.
- For a release, change and commit only the repository-root VERSION file. Source app.conf and app.manifest retain placeholders, and generated packages allocate the next build automatically.
- Added profile-manifest enforcement so Splunkbase packages omit internal-only files that the release does not use.
- Moved the complete guide and release history into this Markdown source and restored accessible release disclosures, Expand all and Collapse all controls, navigation, search, and complete PDF export.

### Upgrade notes

1. Preserve customer-managed `local` configuration through the upgrade process.
2. Open Setup and review supporting packages, routing macros, optional CIM allow lists, and acceleration readiness.
3. Test representative dashboards and shared workspaces with the roles that use them.
4. Confirm the installed version and build in the app header before reporting a problem.
:::

::: release Release Notes | August 2026 - Version 1.0.46
### Published package record

- Introduced the Agentic Security Operations Center workspace and accelerated network-data-model searches for its conference catalogue.
- Added the narrow `ssne_manage_insights_workspaces` capability for shared workspace and topology management.
- Strengthened package provenance, shared image boundaries, Dashboard Manager editing, and workspace accessibility.

The public package listing is the authoritative record of the exact archive published for this version.
:::

::: release Initial beta release | Version 1.0.45
This is the first beta release of Splunk App for Secure Networking. It provides Cisco-focused dashboards, configurable workspaces, and investigation tools in Splunk Enterprise.

### Highlights

- Organizes secure networking content around Zero Trust Access, Secure Infrastructure, Scalable Network Segmentation, Hybrid Mesh Firewalling, and Agentic Ops.
- Includes 16 Cisco-themed Dashboard Studio views for executive insights, network and security operations, infrastructure health, workplace intelligence, and investigations.
- Provides configurable Insights Workspaces with KPI tiles, layouts, signal rails, connectivity maps, themes, and audience-specific views.
- Includes Dashboard Manager tools for creating, editing, cloning, exporting, and presenting dashboards.
- Adds interactive topology tools, drilldowns, Open in Search actions, and a searchable catalogue of shared searches.

### Setup and data readiness

- Guides users through supporting-app validation, Cisco source-type discovery, index-macro configuration, and data-model acceleration checks.
- Supports macro configuration for Cisco networking, security, observability, infrastructure, and workplace integrations.
- Includes an in-app User Guide for setup, dependencies, performance readiness, and troubleshooting.

### Beta considerations

- This release is available only to approved beta participants.
- The app visualizes data already indexed in Splunk Enterprise; it does not collect Cisco data.
- Dashboard results depend on the integrations, source types, fields, data models, index mappings, permissions, and time ranges available in each environment.
- Features, content, and compatibility can change before general availability.
:::

::: release Initial Alpha release | Version 1.0.44
This is an Alpha release of Splunk App for Secure Networking. It provides Cisco-focused executive, network operations, security operations, infrastructure, and building-intelligence experiences within Splunk.

### Highlights

- Introduces Secure Networking experiences organized around Zero Trust Access, Secure Infrastructure, Scalable Network Segmentation, Hybrid Mesh Firewalling, and Agentic Ops.
- Includes 16 Cisco-themed Dashboard Studio views containing executive KPIs, operational trends, security findings, topology context, and investigation workflows.
- Provides executive briefing, IT health, security, Asset Inventory, NetOps Readiness, Cisco Spaces, workplace, and building-intelligence views.
- Adds configurable Insights Workspaces with selectable KPI tiles, layouts, signal rails, site-connectivity maps, presentation themes, and audience-specific views.
- Includes Dashboard Manager tools for viewing, editing, cloning, exporting, and presenting supported dashboards.
- Provides interactive customer-site topology and network-diagram tools.
- Adds drilldowns and **Open in Search** actions for investigating dashboard results directly in Splunk Search.
- Includes a searchable catalogue of shared search definitions for dashboard, workspace, and investigation workflows.

### Data configuration and readiness

- Adds guided setup for validating supporting apps, discovering Cisco source types, and configuring index macros.
- Provides Macro Index Tuning for mapping dashboard searches to indexes used by the local Splunk environment.
- Supports separate discovery and configuration of Splunk Common Information Model index macros.
- Reports required and recommended data-model acceleration readiness, with links to the applicable Splunk management pages.
- Supports companion macro configuration for Cisco Enterprise Networking, Cisco Security Cloud, Cisco ThousandEyes, Cisco Meraki, Cisco Intersight, and Cisco Spaces integrations.
- Includes an in-app User Guide covering setup, data dependencies, macro tuning, workspaces, site connectivity, performance readiness, and troubleshooting.

### Security and operational content

- Includes authentication, policy-enforcement, user-activity, remote-access VPN, segmentation, infrastructure-health, firewall, and threat-detection dashboards.
- Provides Palo Alto policy-outcome and Cisco ISE Security Group Tag correlation content where the required data is available.
- Includes Cisco SD-WAN controller threat hunts for suspicious access, software downgrade, certificate failures, path traversal, privilege escalation, persistence, and multi-stage activity.
- Provides Cisco Catalyst Center, Secure Firewall, ISE, Meraki, ThousandEyes, Spaces, Duo, Cyber Vision, UCS, Intersight, SD-WAN, data-center networking, Secure Access, and XDR content where supported telemetry is present.

### Alpha release considerations

- This release is available only to approved Alpha participants.
- Splunk App for Secure Networking visualizes data already ingested into Splunk; it does not collect Cisco data directly.
- Dashboard availability and results depend on supporting apps, source types, fields, data models, index mappings, permissions, and time ranges.
- Not every supporting integration is required for every dashboard.
- Some features require accelerated data models or optional supporting apps.
- Alpha functionality, content, and compatibility may change before a generally available release.
:::

::: release Initial Alpha release | Version 1.0.35
This is the first Alpha release of Splunk App for Secure Networking. It provides Cisco-focused executive, network operations, security operations, infrastructure, and building-intelligence experiences within Splunk.

### Highlights

- Introduces Secure Networking experiences organized around Zero Trust Access, Secure Infrastructure, Scalable Network Segmentation, Hybrid Mesh Firewalling, and Agentic Ops.
- Includes 16 Cisco-themed Dashboard Studio views containing executive KPIs, operational trends, security findings, topology context, and investigation workflows.
- Provides executive briefing, IT health, security, Asset Inventory, NetOps Readiness, Cisco Spaces, workplace, and building-intelligence views.
- Adds configurable Insights Workspaces with selectable KPI tiles, layouts, signal rails, site-connectivity maps, presentation themes, and audience-specific views.
- Includes Dashboard Manager tools for viewing, editing, cloning, exporting, and presenting supported dashboards.
- Provides interactive customer-site topology and network-diagram tools.
- Adds drilldowns and **Open in Search** actions for investigating dashboard results directly in Splunk Search.
- Includes a searchable catalogue of shared search definitions for dashboard, workspace, and investigation workflows.

### Data configuration and readiness

- Adds guided setup for validating supporting apps, discovering Cisco source types, and configuring index macros.
- Provides Macro Index Tuning for mapping dashboard searches to indexes used by the local Splunk environment.
- Supports separate discovery and configuration of Splunk Common Information Model index macros.
- Reports required and recommended data-model acceleration readiness, with links to applicable Splunk management pages.
- Supports companion macro configuration for Cisco Enterprise Networking, Cisco Security Cloud, Cisco ThousandEyes, Cisco Meraki, Cisco Intersight, and Cisco Spaces integrations.
- Includes an in-app User Guide covering setup, data dependencies, macro tuning, workspaces, site connectivity, performance readiness, and troubleshooting.

### Security and operational content

- Includes authentication, policy-enforcement, user-activity, remote-access VPN, segmentation, infrastructure-health, firewall, and threat-detection dashboards.
- Provides Palo Alto policy-outcome and Cisco ISE Security Group Tag correlation content where the required data is available.
- Includes Cisco SD-WAN controller threat hunts for suspicious access, software downgrade, certificate failures, path traversal, privilege escalation, persistence, and multi-stage activity.
- Provides Cisco Catalyst Center, Secure Firewall, ISE, Meraki, ThousandEyes, Spaces, Duo, Cyber Vision, UCS, Intersight, SD-WAN, data-center networking, Secure Access, and XDR content where supported telemetry is present.

### Alpha release considerations

- This release is available only to approved Alpha participants.
- Splunk App for Secure Networking visualizes data already ingested into Splunk; it does not collect Cisco data directly.
- Dashboard availability and results depend on supporting apps, source types, fields, data models, index mappings, permissions, and time ranges.
- Not every supporting integration is required for every dashboard.
- Some features require accelerated data models or optional supporting apps.
- Alpha functionality, content, and compatibility may change before a generally available release.
:::
