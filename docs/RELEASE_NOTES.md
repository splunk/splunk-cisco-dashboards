# Release notes

## 1.0.34

- Guided setup now combines package validation, macro discovery, data-model
  acceleration readiness, targeted Data Models links, and an Open in Search
  path for the readiness check.
- Insights Workspaces now retain their own section and tile choices, signal
  rail, map configuration, and light, dark, or system theme. Templates are
  used only to start a new workspace.
- Customer Site Connectivity can discover ThousandEyes agent-to-agent inputs,
  bind a selected test, and link operators to the corresponding test.
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
- The in-app User Guide now documents the workspace, site-connectivity,
  Searchbase, performance-readiness, and release-notes workflows.
