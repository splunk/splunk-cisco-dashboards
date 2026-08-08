# Release notes

## 1.0.36

- Dashboard Manager now handles internal Dashboard Studio `/drilldown` links
  in place, resolves their Searchbase targets, and opens the selected detail
  search with the dashboard's active time range. Drilldown triggers use the
  same open-details-panel icon as the home dashboard, and multiple targets load
  one at a time instead of dispatching in parallel.
- Secure Networking Dashboard Studio trends now use 27 true area charts with
  brighter sky, cyan, emerald, amber, orange, rose, violet, teal, and slate
  series colors plus thicker outlines for dark-mode visibility. Thirteen faint
  single-value sparklines and five remaining line charts were upgraded while
  categorical and point-in-time visualizations retain their best-fit types.
- Theme-capable dashboards now synchronize Splunk's side navigation and
  navigation drawer with each dashboard's resolved light or dark mode. This
  applies live, without reloading or discarding unsaved canvas work, across
  Searchbase Canvas, Insights Workspace profiles, Health Monitoring, Network
  Diagram, Secure Operations Glass, and Dashboard Studio.
- Insights Workspace profile pages now opt into Splunk's dark Classic XML
  shell, so the side navigation matches the shipped dark workspace theme
  instead of remaining light beside a dark dashboard.
- Dashboard Studio visualization descriptions now wrap to a bounded three-line
  header across all five Secure Networking pillars and their detail dashboards.
  Native panels resize into the remaining space, avoiding one-line truncation
  without requiring separate markup visualizations.
- Topology Editor site roles now use the SUI 5.13 Select component with a
  persistent color swatch for every option and selected value. All 12 factory
  roles have unique colors shared by the editor, map beacons, and role legend.
- Dashboard Manager now passes numeric canvas dimensions to Dashboard
  Framework 29.8, preventing managed Studio dashboards from falling back to a
  600-pixel canvas with a premature scrollbar and empty page area below it.
- The five Secure Networking pillar dashboards now use the Insights Workspace
  dark palette: slate canvas and panel surfaces, slate text, sky accents, and
  matching semantic status colors keep Dashboard Studio visually aligned with
  `secure_networking_profile`.
- Insights Workspace headers now present time-range and auto-refresh selectors
  without box borders. Signal Rail pause, style, and configuration controls
  reveal on desktop hover or keyboard focus while remaining visible on compact
  layouts, and metric help uses a larger filled Splunk React information icon.
- All 45 Secure Networking factory overview searches now use explicit,
  bounded `timechart` contracts and render with a best-fit line, area, or
  column trend. Window-level headline values remain available alongside
  48- or 60-bucket spark fields; the five former categorical overview tiles
  retain their detailed breakdowns in the existing drill-down tables.
- Added a documented SUI 5.13 / Themes 1.10 / Cisco Cloud Control alignment
  matrix, including the deliberate boundary between Splunk global chrome and
  the application content surface.
- Insights Workspace signal rails now default to comfortable density, support
  small, standard, and large KPI text, and use the full rail width instead of
  reserving a fixed label block. Tile drag and remove actions appear only from
  the top-left action corner, and the theme control uses compact icon-only
  spacing.
- Signal Rail style choices are usable again: the compact rail keeps its KPI
  marquee clipped without clipping the style picker, so users can switch among
  all five visual treatments.
- Insights Workspace headers now reserve more room for the workspace title by
  using compact time-range and auto-refresh selectors, quieter manual-refresh
  styling, tighter action spacing, and a status badge that collapses to its
  shield icon on narrow screens. The map action uses Splunk's globe icon, while
  the workspace switcher uses the SUI layers metaphor and no longer duplicates
  Splunk Web's signed-in user control.
- The time-range and auto-refresh controls now use SUI 5.13 `Select`
  components with an explicit high-contrast dark-toolbar treatment so their
  labels and carets remain visible regardless of Splunk's outer theme. H1 is a
  real compact section layout with tighter headline, chart, and wrapped-row
  floors rather than a cosmetic height label.
- Customer connectivity now opens on the geographic topology by default. The
  animated Command view remains available for quickly scanning sites, paths,
  health, and critical relationships, while Geo also opens automatically when
  editing coordinates.
- The Secure Networking factory layout is now an exact five-by-nine contract:
  45 unique active tiles, 45 uniquely resolved drill-down links, explicit
  headline fields on every tile, explicit spark fields on time-series tiles,
  and numeric or documented qualitative threshold guidance throughout. Shared
  detail searches use one bounded empty-result contract without changing their
  populated schemas.
- Insights Workspace metric, chart, and detail drill-down dialogs now share a
  responsive translucent Cisco dark-mode shell with content-specific
  footprints, compact headers, consistent Search/Details/Close actions,
  keyboard focus trapping, focus restoration, and mobile bottom-sheet
  behavior. A lighter, softer backdrop keeps the workspace recognizable behind
  the exact SUI 5.13 high-glass tint. Detail tables auto-size to the
  viewport and add accessible width, height, and corner resize controls with
  double-click reset. Loading, empty, and failure states now use one accessible
  treatment across every detail drill-down, including a consistent recovery
  path for empty and failed searches.
- Insights Workspace accessibility now uses a continuous `h1`/`h2` page and
  section hierarchy. Pointer-only modal backdrops are excluded from the
  accessibility tree so screen readers announce one Close control while the
  visible Close button, Escape handling, focus trapping, and focus restoration
  remain available to keyboard users. Sparkline gradients now use unique SVG
  identifiers so repeated tile colors cannot create duplicate DOM references.
- Executive Insights composition tiles now use Splunk's native Dashboard
  Studio ranked-bar renderer with explicit category/value bindings, visible
  values, matching dark-theme colors, and lazy loading so the optional native
  visualization bundle does not inflate the initial workspace entrypoint.
  Composition and categorical bar charts use the same deliberate
  expand-dialog interaction as time-series tiles instead of enlarging on hover.
- Webpack performance warnings now use measured JavaScript budgets appropriate
  for self-contained, unminified Splunk watch bundles. `yarn bundle:report`
  reports every entry and async chunk against its regression budget; lazy
  loading the native composition renderer reduced the initial Executive
  Insights and Searchbase Canvas entrypoints by roughly 8 MB each.
- Executive Insights tile actions are slightly larger, and drilldowns now use
  an open-details-panel icon with explicit drilldown tooltips instead of an
  ambiguous table glyph.
- Every built-in Insights Workspace now ships a distinct named topology and
  audience-specific header and six-KPI signal rail preset. The Executive
  Briefing now opens as Global Operations Command with decision-oriented copy.
  Secure Network Command Map,
  Identity Trust Journey, Resilience Path Atlas, Threat Response Theater, and
  Global Operations Pulse pair with rails focused on secure networking, zero
  trust, resilience, SOC, and executive outcomes. The Secure Networking rail
  maps one KPI to each pillar plus a bounded Palo Alto enforcement trend whose
  drill-down correlates firewall activity with Cisco ISE identity. Saved map
  edits remain workspace-scoped, and untouched legacy titles migrate safely.
- Workspace Manager now offers the complete cross-domain section catalogue to
  every demo workspace. Secure Networking, Security Operations, IT Operations,
  Digital Experience, and Executive Command Signals retain focused template
  defaults while sharing their real Searchbase-backed tile catalogues.
- Signal Rail presets are now centrally governed in
  `insights_workspaces.conf`, while sparse personal differences are saved in
  the authenticated Splunk user's workspace namespace. Rapid editor changes
  are coalesced, preferences are capped at 24 items, and reset returns to the
  latest shared workspace default. Empty personal-preference lookups now return
  a successful collection response instead of an expected 404.
- Hybrid Mesh Firewalling now includes bounded Palo Alto policy-outcome and
  per-SGT traffic timecharts in its shared workspace layout. Each trend drills
  into its corresponding effectiveness rollup or correlated flow table, and
  policy actions normalize both PAN and CIM allow/block variants. The section
  remains capped at nine distinct factory tiles by replacing redundant HMF
  summaries instead of appending beyond the workspace contract.
- Secure Networking Searchbase metadata now uses the five exact app-menu
  section names, keeping workspace discovery and filtering aligned with Zero
  Trust Access, Secure Infrastructure, Scalable Network Segmentation, Hybrid
  Mesh Firewalling, and Agentic Ops.
- Six Palo Alto and firewall searches now minimize last-24-hour dispatch cost:
  PAN/ISE correlations extract only their source-specific fields before
  enrichment, while blocked-versus-allowed trends use one accelerated
  data-model scan instead of appended scans.
- Eight demo-bound Searchbase searches now use portable Cisco Catalyst Center,
  Secure Firewall, SD-WAN UTD, Cisco Spaces, and ThousandEyes source contracts;
  every live Searchbase pipeline also avoids redundant `spath` commands.
- Searchbase now keeps 156 disconnected, currently nonworking searches in a
  non-runtime archive while preserving every search referenced by a dashboard,
  drilldown, or Insights Workspace. Automated integrity checks prevent archived
  IDs or display names from being reintroduced into live runtime references.
- Dashboard Manager view mode now adds Studio-style Display, zoom, Export JSON,
  and Clone controls alongside the existing Download and Edit actions. Display
  supports fullscreen and temporarily hiding Splunk navigation without leaving
  the Searchbase-capable manager renderer.
- Dashboard Manager edit mode now promotes its Searchbase catalogue control to
  a labeled Cisco-accented action with clearer guidance, and Searchbase-wired
  dashboards show a dismissible context and portability notice on each edit
  entry. Convert messaging now distinguishes native Studio compatibility from
  remaining app, macro, lookup, data-model, command, and data dependencies.
- All 16 Secure Networking canvases now use compact headers and 190-300 pixel
  visualization rows instead of the previous 408-438 pixel panels, reducing
  dashboard height while preserving panel order, searches, and drilldowns.
- Executive Overview, Threat Detection and Enforcement, Authentication and
  Policy Enforcement, and Secure Infrastructure Status now render all 13
  single-value KPIs with time-bucketed sparklines and percent trends.
- Secure Networking visualization fixes now plot SD-WAN site coordinates on a
  world view, supply the Segmentation binding pie with a strict category/value
  result shape, and present ISE RADIUS latency with concise node labels,
  bounded series, connected samples, and millisecond axis labeling.
- All 16 Secure Networking Dashboard Studio views now use a Cisco-inspired
  dark-mode information hierarchy with purpose-led headers, compact audience
  and source context, decision-oriented section guidance, and visible
  Searchbase-derived descriptions on all 131 data panels. Existing searches,
  tokens, drilldowns, and data-source references are unchanged.
- Searchbase now includes eight Cisco SD-WAN controller threat hunts for rogue
  peering, software downgrade, certificate failures, CVE-2022-20775 path
  traversal, root access, local-account persistence, and attack-stage
  correlation using off-appliance controller syslog.
- Macro Index Tuning now includes all three Cisco Enterprise Networking app
  routing macros, including its sourcetype allow-list, and identifies each
  supported App or TA by both its display label and install folder.
- Macro Index Tuning now also manages the installed Cisco Meraki, Cisco
  Intersight, and Cisco Spaces index macros from the same scan and setup flow.
- Macro Index Tuning now opens with a compact scan overview and independently
  collapsible app coverage, search-performance, macro-definition, CIM, and
  diagnostic sections, including global expand-all and collapse-all controls.
- Macro Index Tuning now provides a CIM-specific batch save and writes CIM
  macro overrides as definition-only stanzas without generated descriptions or
  redundant `iseval` settings.
- Dashboard browser tabs now use the consistent `SASN | Dashboard name` format
  without displaying the Splunk product version.
- On-demand CIM discovery can now tune all 25 Splunk Common Information Model
  index macros using each data model's shipped tag constraints.

## 1.0.34

- Macro Index Tuning now separates the dashboard-macro heading from its search
  and action controls, and its factory acceleration macro no longer applies a
  global <code>fillnull_value</code> policy to every <code>tstats</code> search.
- User Guide is now a first-class left-navigation item with its own notebook icon,
  so it remains directly available from every app page.
- Secure Network Segmentation now includes Palo Alto traffic detail and policy
  effectiveness searches enriched with Cisco ISE Security Group Tags by source
  IP.
- Guided setup now combines package validation, macro discovery, data-model
  acceleration readiness, targeted Data Models links, and an Open in Search
  path for the readiness check.
- Insights Workspaces now retain their own section and tile choices, signal
  rail, map configuration, and light, dark, or system theme. Templates are
  used only to start a new workspace.
- Customer Site Connectivity can discover ThousandEyes agent-to-agent inputs,
  bind a selected test, and link operators to the corresponding test.
- The factory Customer Site Connectivity map now starts with New York City,
  San Francisco, and Houston, with two healthy demo links and one warning link.
- Factory site and path drill-ins now include clearly labeled demonstration
  health, device, alert, capacity, utilization, latency, loss, and jitter
  values, so the topology is useful before live telemetry is connected.
- Factory links now offer a generic ThousandEyes launch link; a bound A2A test
  continues to replace it with a direct test view.
- Factory topology now fits its three demonstration sites when opened from any
  workspace; a saved custom map view remains authoritative.
- Searchbase Canvas distinguishes failed searches, supports app filtering, and
  updates app counts from the active filters.
- The Insights tile picker and Searchbase filters show friendly Splunk app
  labels while retaining the app directory name as hover detail.
- Search pickers now start at All apps across Insights, Signal Rail, Dashboard
  Manager, and topology editing, while still allowing operators to narrow by
  app when needed.
- App choices and counts in the Insights and Signal Rail pickers now honor the
  hidden, drill-down, and table-search visibility filters.
- Dashboard Manager keeps its selected-KPI count, Cancel, and Add selected
  actions above the scrolling results so they remain available during browsing.
- Dashboard Manager now records the owning app for newly added Searchbase data
  sources, allowing cross-app searches to resolve while preserving their
  configured execution-context behavior.
- Dashboard Manager Searchbase additions now use the dashboard's active time
  input, including automatic repair of earlier additions that referenced an
  unavailable global-time token.
- Setup now remains finishable when automatic index-macro discovery fails, so
  administrators can retry optional macro tuning afterward.
- Dashboard Studio editor chrome now follows the saved dashboard theme so dark
  dashboards no longer render against light editor controls.
- Dashboard Studio confirmation dialogs now use the edited dashboard's theme,
  including their click-away overlays.
- Dashboard Studio now explicitly themes portal-rendered dialog backdrops from
  the saved dashboard theme, preventing a light Splunk shell from washing out
  a dark dashboard editor.
- Dashboard Manager now loads its installed CSS and JavaScript directly after
  an in-place update, avoiding stale Splunk Web static-asset namespaces.
- Tile search replacement now clearly confirms that the change is shared with
  viewers of the current workspace, rather than describing it as org-wide.
- Adding a search tile now explicitly distinguishes a browser-local “For me”
  choice from a permission-gated shared-workspace choice.
- The in-app User Guide now documents the workspace, site-connectivity,
  Searchbase, performance-readiness, and release-notes workflows.
