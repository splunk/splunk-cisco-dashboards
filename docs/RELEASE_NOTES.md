# Release notes

## 1.0.36

- Macro Index Tuning now includes all three Cisco Enterprise Networking app
  routing macros, including its sourcetype allow-list, and identifies each
  supported App or TA by both its display label and install folder.
- Macro Index Tuning now also manages the installed Cisco Meraki, Cisco
  Intersight, and Cisco Spaces index macros from the same scan and setup flow.

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
