# Release notes

## 1.0.36

- Executive Insights pie tiles now use Splunk's native Dashboard Studio pie
  renderer with larger charts, visible values and percentages, and matching
  dark theme colors. Pie and categorical bar charts share hover or
  keyboard-focus magnification for closer inspection.
- Executive Insights tile actions are slightly larger, and drilldowns now use
  an open-details-panel icon with explicit drilldown tooltips instead of an
  ambiguous table glyph.
- Every built-in Insights Workspace now ships a distinct topology and signal
  rail preset, including London-Paris-Frankfurt, APAC resilience, Americas SOC,
  and global executive connectivity stories. Saved topology edits are scoped
  to the owning workspace.
- Secure Network Segmentation now includes bounded Palo Alto policy-outcome
  and per-SGT traffic timecharts that drill into the existing effectiveness
  rollup and correlated flow table; policy actions normalize both PAN and CIM
  allow/block variants.
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
