# @splunk/splunk-cisco-dashboards

Splunk app for Cisco data that combines React workspaces with native
Dashboard Studio views. The main React entry points cover Insights,
health monitoring, topology, searchbase authoring, operations, guidance,
and dashboard management; the packaged Studio views cover the secure
networking pillars and workplace scenarios.

## Release notes

### Unreleased

- Updated the Secure Networking workspace sidebar, pillar tab menu, and
  Dashboard Studio pillar headers to use the new Fingerprint Nodes, Server
  Brackets, Globe Division, Column Arrows Left-Right, and Robot Face Sparkle
  icons.
- Replaced the bespoke Dashboard time range editor with Splunk's native
  time-range selector, including preset, relative, date-range, date-and-time,
  and advanced modes.
- Made operational trend buckets follow the active dashboard time range across
  Agentic SOC, building and workplace intelligence, Catalyst Center,
  ThousandEyes, Secure Networking Assurance, security, data-center, and IOS-XR
  searches while retaining fixed grids for forecasts and interval-dependent
  calculations.
- Expanded Cisco Security model coverage with FTD event-volume, application,
  file/malware, advanced-logging, and DNS summaries. Guided Setup now detects
  Cisco Intersight data, includes its model in acceleration readiness, and ships
  a root-versus-child coverage diagnostic while retaining field-dependent raw
  searches until their model children preserve the required data.
- Focused the Insights Workspace's App details and upgrades action on exact
  Secure Networking Essentials catalog results, filtered to the app's IT
  operations, network security, developer-support, and CIM 8.x metadata.
- Restored readable semantic trend colors across all 17 managed Secure
  Networking dashboards. Visible single-value deltas now apply their configured
  positive, neutral, negative, or informational palette instead of falling back
  to black on dark cards, with a color and contrast contract covering every
  shipped dark Dashboard Studio view.
- Made package artifacts operator-readable as
  `splunk-cisco-dashboards-<version>-<build>.tar.gz`, with no separate checksum
  sidecar and with immutable collision checks retained. Packaging validates the
  completed archive internally before publication. Build, install, deploy, and remote
  workflows now default to the released-resources-only SplunkBase profile;
  developer resources require `--developer` or the explicit `--fast` workflow.
  Local install/deploy validation accepts intentional uncommitted source and
  marks dirty artifacts non-release-eligible, while build-only and remote
  release artifacts retain the clean-source gate.
- Restored Street, Terrain, Satellite, Dark Ops, Navigation, and Offline Grid
  map styles with normal interactive zoom. Topology placement remains restricted
  to the offline city list or explicit coordinates, so operator-entered location
  text is never sent to a public geocoder; online styles issue only fixed,
  API-key-free map-tile requests to their attributed Esri provider.
- Restricted shared workspace, topology, and Dashboard Builder background
  management to `admin`, `sc_admin`, and explicitly delegated custom roles.
  Built-in `user` and `power` roles remain read-only for shared configuration
  while retaining personal workspace preferences. The delegated capability is
  named `ssne_manage_insights_workspaces` to match the SSNE product acronym.
- Simplified release preparation to one operator-maintained value: change the
  repository-root `VERSION` file while source `app.conf` and `app.manifest`
  retain placeholders. Generated packages stamp the release metadata and
  automatically allocate the next build above release history, readable local
  artifacts, and the installed target when available.
- Made Dashboard Manager easier to resume: library cards and preview dialogs
  now expose direct edit actions, and Searchbase picker rows start compact with
  a toggle for full search metadata. New dashboards default to Shared in App,
  with a Private option retained in the create dialog.
- Restricted Dashboard Builder background uploads to bounded PNG, JPEG, GIF, or
  WebP data, persisted them through the capability-protected shared
  configuration handler, and ignore unsupported stored sources in the picker.
- Applied the same shared image-source boundary to Cisco Spaces floor-plan
  visualizations, so stored map images cannot cause viewer browsers to fetch
  arbitrary network or local URLs.
- Made release staging reject ignored Splunk resource inputs and exclude common
  local-secret files before they can reach a watcher-linked app or SplunkBase
  archive.
- Bound the update-discovery package ID and archive provenance to the numeric
  SplunkBase listing ID recorded in the committed release ledger.
- Documented the bounded, capability-protected Dashboard Builder background
  registry and its Search Head Cluster behavior.
- Aligned staged app metadata with the canonical release version, preserved
  package-time version stamping, enabled app-upgrade notifications, and added
  a reproducible root `yarn test` contract suite.
- Upgraded React Router to the supported 7.18.2 line and raised the supported
  Node.js development/build baseline to 20.
- Made the CIM-tuning footer reflect discovery and selection state, blocked
  continuation while discovery is running, and restored readable semantic
  colors for routing and CIM definition previews in dark mode.
- Restored keyboard focus without scrolling after clearing Configure tile
  filters, closing Help, and leaving an expanded tile visualization.
- Replaced custom setup routing value pills and their expansion controls with
  native Splunk UI components, and corrected Insights Workspace Help so it
  points to the tile action menu and explicit section link users actually see.
- Added contextual help actions to Configure tile option panels, with concise
  explanations and direct links to the matching official Splunk documentation.
- Added a complete native React Secure Networking Pillars dashboard with five
  URL-backed tabs and 30 Searchbase-powered cards. The workspace mirrors the
  home-page design system, supports light and dark appearance, and provides
  contextual investigation dialogs while retaining direct Studio comparison.
- Clarified Configure tile search filtering by removing the tag-vocabulary total
  from `All tags`, adding a live matching-search count, and correcting singular
  and plural wording in per-tag counts.
- Prevented Configure tile visibility changes and filter clearing from replaying
  the bound-search auto-scroll, so the Search drawer stays at the operator's
  current position while its catalogue refreshes.
- Added an `Open in Searchbase` action to Insights Workspace tile menus so
  operators can open the exact backing stanza in the Searchbase SPL editor
  without leaving the dashboard.
- Set the packaged Agentic SOC and Security Operations Demo sections to three
  visible tiles for users without saved workspace customizations, while keeping
  every configured tile available from the section controls.
- Made Agentic SOC factory reset exhaustive by clearing every packaged
  workspace, layout, Searchbase, and Signal Rail override even when an effective
  local configuration had hidden items from the dashboard.
- Moved the NetOps Readiness time picker into the dashboard title bar on every
  tab, matching the native Dashboard Studio layout and removing the redundant
  input strip above the tab navigation.
- Added a built-in Agentic Security Operations Center workspace with 36
  Searchbase searches across DNS Security, Firewall Threat Defense, Network
  Detection & Response, and Unified Detection & Investigation. Each section
  includes nine purpose-built views, while the six-signal rail and clearly
  labeled fallback rows keep empty or unavailable conference feeds honest.
- Corrected Secure Group Tag enrichment searches to invoke the packaged
  `sgt_naming` lookup transform and exported its transform and CSV for app-wide
  reads.
- Curated Dashboard Manager to show only the packaged dashboards that depend on
  its Dashboard Studio extensions and the current user's dashboards created
  through the managed workflow. Ordinary Studio dashboards remain excluded even
  when they use the Manager route for presentation compatibility. The library
  and editor introduce the `Dashboards in 60 Seconds` promise, explain how
  Searchbase and Dashboard Studio support dashboard building without writing
  SPL or code, and call out guided drilldown wiring as a key extension. The help
  also identifies the custom preset and editor integration for technical
  readers. The workflow uses dashboard ACL ownership for `Yours` and provides a
  clear empty state. Dashboard Manager help is concise, keyboard-accessible,
  and uses semantic colors in both light and dark mode.
- Dashboard Manager now marks a saved dashboard `isVisible="false"` whenever
  its definition uses a Manager-only data source, visualization, or input. This
  keeps dashboards that require the extended runtime out of Splunk's standard
  Dashboards listing, while definitions made entirely from native Dashboard
  Studio components remain visible and can open in regular Dashboard Studio.
- Rolled the approved Zero Trust Posture presentation framework across all 17
  included Secure Networking dashboards and 102 cards while preserving each
  six-card operational story and Magnify+ investigation target. Dashboards use
  coordinated palette variation, hidden Y-axis chrome, and a shorter full-width
  canvas that refits when the browser or display size changes. Every card also
  has a separate information action for its primary metric and direct
  Searchbase source. Time pickers default to automatic `timechart` buckets and
  apply a fixed span only when the user enters an explicit override.
  Information and investigation dialog titles remain consistent with the card
  titles that open them, and the shared modal retains its layered charcoal/navy
  surfaces and high-contrast guidance text.
- Completed a semantic visualization-variety rollout across all 17 managed
  Dashboard Studio views. Each card now uses a purposeful line, stacked or
  unstacked column, ranked horizontal bar, or compact table based on its search
  result shape and operational question instead of defaulting every metric to an
  area trend. KPI headlines use explicit units and corrected selected-window
  semantics, while charts suppress unnecessary Y-axis labels, ticks, lines, and
  grid chrome. The rollout preserves each card's coordinated series palette and
  its About and Magnify+ investigation actions.
- Hid Dashboard Manager-only Secure Networking views from Splunk's native
  Dashboards catalogue so customers enter them through the supported manager
  route with custom time and Searchbase wiring intact.
- Updated dashboard drill-down controls to use a magnifier-plus icon button with
  an `Investigate drivers` tooltip and accessible label on hover and keyboard
  focus.
- Repaired Searchbase and Dashboard Studio drill-down routing, replaced weak
  aggregate-to-aggregate pivots with event-level firewall, wireless, and SD-WAN
  detail searches, clarified tile-level action labels, and preserved each
  destination's configured visualization in Insights Workspace.
- Live-validated all five Secure Networking pillars and replaced empty
  site-connectivity, SGACL-denial, and RaVPN-posture pivots with populated,
  multi-source investigation paths spanning site health, link and tunnel state,
  policy and SGT evidence, and posture-aware session detail.
- Corrected three Multi-Site Orchestrator syslog searches so RFC-style events
  render Event Time, Device IP/Name, Severity, and Message instead of a
  multivalue Severity-only table, while retaining compatibility with the
  partner app's legacy colon-delimited field extractions.
- Redesigned first-run setup as a clear six-step guided flow with explicit
  START and FINISH lines, responsive progress navigation, persistent dark and
  Light modes, a dedicated Tune CIM models step before final review, and the
  full Splunk Secure Networking Essentials product name throughout the journey.
- Added Home's account-scoped Light and Dark Appearance choices to the User
  Guide, including the same official Splunk Sun and Moon icons. Setup now uses
  the matching Splunk Sun icon beside its Light mode control in both the static
  readiness steps and the integrated React steps.
- Expanded setup performance readiness to cover 14 supported data models,
  including Cisco Intersight, the eight DC Networking models, and CIM
  Authentication and Network Traffic, while requiring product-specific models
  only when matching data is detected. The compact inventory and
  accelerated-only gate omit product models when their matching data is absent.
- Documented the search-source preference: use CIM when it preserves the
  required semantics, use Cisco app or add-on models for vendor-specific fields,
  and retain raw searches when neither model can represent the panel faithfully.
- Prevented parameterized system helpers and foreign app macros from entering
  setup routing SPL, and kept Step 4 incomplete until its routing scan succeeds.
- Added index multiselects that build routing macro definitions automatically,
  aligned the setup progress rail, and updated the Enterprise Networking app
  add-on, and required data-model names throughout the setup experience.
- Routed missing-package actions to Splunk's Browse More Apps screen with a
  package-specific search so administrators can find and install dependencies
  without leaving the setup workflow behind.
- Kept a full blue `Select indexes` action visible beside every routing row and
  fit the Step 4 review table inside its panel without horizontal scrolling.
- Moved the Step 4 routing scan controls to the top of the workflow and added
  the same indeterminate progress feedback used by CIM discovery.
- Kept setup routing, CIM, and performance edits as drafts until final review,
  added confirmed abandon and save actions, and added an app-by-app before/after
  change summary in the finish step.
- Made repeated CIM discovery additive so saved allowlist values are preserved,
  newly detected indexes are merged into the draft, and an unreadable current
  definition cannot be replaced by an unsafe proposal.
- Made CIM discovery a read-only matching step and added an explicit data-model
  picker before review. No model is selected automatically, unselected
  allowlists remain unchanged, and only selected proposals can enter the Step 6
  change plan or final save.
- Corrected Step 4 search-performance radio sizing so selectors remain circular
  in both Light and dark setup modes, and kept expanded setup inventories inside
  the scrollable content area so the header and action footer remain available.
- Kept CIM model names, macro identifiers, and configuration paths stacked
  inside their table cell so allowlist reviews remain readable at narrow widths.
- Kept routing macro names, target apps, and configuration paths stacked inside
  their table cell so routing reviews remain readable at narrow widths.
- Restored a visible CIM index browser for every model and standardized edited
  and discovered allowlists on the compact `index IN (index1, index2, ...)` form.
- Defaulted CIM discovery to the last 15 minutes, added an indeterminate
  progress bar plus clear completion feedback, and displayed each generated
  definition in a compact review table that fits without horizontal scrolling.
- Styled each CIM `Browse indexes` action as a blue standalone control so its
  edit behavior is clear without repeating a primary button in every row.
- Restricted the Step 5 CIM inventory to the 22 approved models, removed the
  `App` model, and retained the clarified `Inventory` and
  `Network Resolution (DNS)` labels.
- Corrected 26 row-oriented Searchbase defaults so multi-dimension and
  multi-series results, including Meraki threat categories, Catalyst device
  health, and ZTNA device outcomes, render as complete tables instead of
  zero-value or incomplete charts.
- Prevented trailing empty time buckets from rendering five-pillar KPI values
  as N/A or producing false trend drops.
- Standardized compact K/M/B/T formatting at exact abbreviation boundaries
  across five-pillar KPI cards.
- Ensured Secure Networking Assurance ships with the other five-pillar menu
  dashboards.
- Capped fractional values shown by all five-pillar Dashboard Studio KPI
  charts at two decimal places while preserving integer counts and category
  labels.
- Corrected the RaVPN Sessions and Posture dashboard so active profiles,
  active regions, failure events, and posture-specific issues use distinct
  metrics; generic connection failures no longer appear as posture outcomes.
- Corrected Segmentation Readiness so active assignments count distinct
  endpoint-to-SGT pairs while Security Groups in Use counts distinct tags.
- Replaced the zero-value Wired-Port Segmentation Exceptions card with SGT
  Site Activity, backed by tagged ISE authentication activity and site detail.

## Runtime prerequisites

- Cisco Enterprise Networking Add-on for Splunk 3.2.44 or later. This version
  is required for the current and retained sourcetype coverage used by the
  packaged searches and accelerated data-model constraints.

The Insights Workspace uses the shared components in
`common/components/workspace/`, including KPI tiles, workspace dialogs,
signal rails, and the customer topology map. Search metadata remains
centralized in `default/searchbase.conf`.

## Branding (workspace title + logo)

Workspace titles and subtitles are defined in
`default/insights_workspaces.conf` and can be updated through Workspace
Manager. A user can also use the header branding editor to override the title,
subtitle, or logo for that workspace in their browser profile.

The Overview ships with a neutral inline network mark as its default logo.
Uploaded logo overrides are stored in the browser as data URIs. The legacy
`customer_name` macro remains packaged only for compatibility with external or
custom dashboards that still reference it; the Insights Workspace no longer
dispatches a search to read that macro.

Each React view is mounted from a Simple XML shell through a RequireJS
bootstrap in `appserver/static/`. That directory also contains the shared app
shell styles and the static assets referenced by Dashboard Manager, Setup, and
the React pages. Native Dashboard Studio definitions are packaged alongside
those shells under `default/data/ui/views/`. `dashboard.css` is the only
convention-loaded exception in the static inventory; Splunk Web loads it
automatically for Simple XML dashboards.

One mount helper is in active use:

* `common/render-raw.tsx` (`mountPageRaw`) — bare mount, no theme
  provider. Used by Overview so Tailwind owns 100% of the styling.

A `common/render.jsx` (`mountPage`) variant that wraps the page in
`SplunkThemeProvider` (Prisma family) is retained for any future React
view that wants Splunk's default theming.

Tailwind is scoped to `#scan-root` (via `important: '#scan-root'` and
disabled Preflight) so the utilities and resets never bleed into the
surrounding Splunk Web chrome.

## Layout

```
packages/splunk-cisco-dashboards/
├── package.json
├── webpack.config.js
├── .babelrc.js                   # @splunk/babel-preset + @babel/preset-typescript
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── .eslintrc.js
├── stylelint.config.js
├── bin/
│   ├── build.js                  # webpack/stage orchestration; pack delegates safely
│   └── package_app.sh            # canonical Splunk release archive builder
└── src/
    └── main/
        ├── webapp/
        │   ├── common/
        │   │   ├── components/
        │   │   │   ├── workspace/ # Workspace tiles, dialogs, signal rail, and topology map
        │   │   │   └── */         # Other shared SUI and topology components
        │   │   ├── hooks/        # Shared search, export, and workspace hooks
        │   │   ├── lib/          # cn() and other utilities
        │   │   ├── services/     # splunkSearchService (SPL allow-list + mock)
        │   │   ├── styles/       # tailwind.css (scoped)
        │   │   ├── types.ts
        │   │   ├── render.jsx    # @splunk/themes mount helper
        │   │   └── render-raw.tsx# bare mount helper (Tailwind dashboards)
        │   └── pages/
        │       ├── executive_insights/
        │       ├── health_monitoring/
        │       ├── topology_canvas_v1/
        │       ├── network_diagram/
        │       ├── searchbase_canvas/
        │       ├── m365_activity_monitoring/
        │       ├── macro_index_tuning/
        │       ├── secure_operations_glass/
        │       ├── user_guide/
        │       └── dashboardbuilder/
        └── resources/
            └── splunk/
                ├── default/
                │   ├── app.conf
                │   └── data/ui/{nav,views}/
                ├── appserver/static/      # shell styles, loaders, and referenced assets
                └── metadata/default.meta
```

## Development

```bash
yarn install                 # from the workspace root
yarn workspace @splunk/splunk-cisco-dashboards start
# or simply, from the workspace root:
yarn start                   # webpack --watch
```

The webpack build emits to `stage/`, mirroring the deployed Splunk app
structure (`appserver/`, `default/`, `metadata/`). A production build
gives you a directory you can symlink into `$SPLUNK_HOME/etc/apps/` or
package as a tarball. The development stage contains both released and
developing app resources; release filtering happens only in temporary package
staging.

## Production build & packaging

```bash
cd ../..
./build.sh                    # Splunkbase: minified, released resources only
./build.sh --developer        # local: released + developing resources
./build.sh --developer --minify # slower, minified developer package
```

The SplunkBase profile always minifies JavaScript and rejects source-map files
or directives. Normal developer builds and `yarn start` keep fast, unminified
production-React bundles.

For a release, edit only the repository-root `VERSION` file. Source `app.conf`
and `app.manifest` keep `0.0.0`/`0` placeholders and are never bumped by the
operator. Packaging stamps generated output and automatically chooses the next
build above the historical ledger, readable `dist/` artifacts, and a local
target's installed build when available. The committed ledger at
[`../../releases/splunkbase-9257.json`](../../releases/splunkbase-9257.json) is
publication history and a build floor, not a manual `current` allocation.
Successful packages are named
`splunk-cisco-dashboards-<version>-<build>.tar.gz` (plus `-developer` for an
explicit developer profile). That tarball is the only emitted package file;
packaging validates it internally, and the root build wrapper verifies its
filename identity and gzip integrity before use.

Resource inclusion is controlled by `config/build-profile-manifest.json`.
The complete workflow and local install command are documented in
[`../../docs/BUILD_PROFILES.md`](../../docs/BUILD_PROFILES.md).

## Mounting model

Each Simple XML view contains:

```xml
<dashboard version="1.1" hideEdit="true" hideExport="true" hideTitle="true"
           script="executive_insights_bootstrap.js">
    <label>Executive Briefing</label>
    <row>
        <panel>
            <html>
                <div id="scan-root"></div>
            </html>
        </panel>
    </row>
</dashboard>
```

`executive_insights_bootstrap.js` waits for the first-run setup gate and then
loads the shared profile-driven React experience:

```js
script.src = '/static/app/splunk-cisco-dashboards/pages/executive_insights.js';
```

That bundle mounts into `#scan-root` and selects either the Executive Briefing
or Secure Networking profile from the current Splunk view name.

## Splunk runtime detection

`common/services/splunkSearchService.js` is the single entry point for
SPL execution.

* In Splunk Web (detected by presence of `window.$C` or a Splunkd CSRF
  cookie) it lazily imports `@splunk/splunk-utils/SearchJob` and runs
  real searches.
* Outside Splunk it falls back to deterministic fixtures so pages still
  render.

You can force one mode or the other with `window.__SPLUNK_RUNTIME__`.

### Security notes

* The shared search service rejects empty, oversized, and control-character
  SPL before it reaches the runtime. App-owned configuration supplies the
  queries; Open in Search values have a separate static-choice and time-range
  guard.
* The Security page time-window selector is allow-listed with an
  enumerated list and re-validated before the search params are formed.
* No Splunk credentials are held by the client — Splunk Web manages auth
  via HttpOnly cookies. The app uses `localStorage` only for user-scoped
  workspace and branding preferences; it does not write Splunk credentials or
  session tokens there.

## License

Copyright 2026 Splunk Inc.

Licensed under the [Apache License, Version 2.0](../../LICENSE). See
[NOTICE](../../NOTICE) for attribution information.
