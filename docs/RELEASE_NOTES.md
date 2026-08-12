# Release notes

## 1.0.36

- Insights Workspace detailed sparklines now retain enough plot height for
  honest trend variation, extrema labels, and timestamps instead of collapsing
  into a horizontal line. Add Search drawers also open with their catalogue
  filters visible, and custom dark-mode controls retain readable component
  colors by using a low-specificity browser-style reset.
- All 16 generated Secure Networking Dashboard Studio stories now reuse the
  exact approved navigation assets for their pillar headers: Fingerprint,
  NetworkDevices, Globe, ArrowsDoubleLeftRight, and RobotAgent. This removes
  the visual mismatch between the app menu and the native Studio dashboards.
- Insights Workspace now begins its Figma-led Cisco shared-design-language
  refresh with SUI glass status cards, restrained SpotLight depth, native
  RadioBar and Select view controls, and token-driven map overlays. The 1CD
  glass KPI row remains static and fits all six factory KPIs in one desktop
  row without repeating the top command bar; motion belongs to the map
  connector trails, which default to static,
  honor reduced-motion preferences, and expose reversible quarter-step speed
  control from 0.25× through 2×. Glass-card navigation is limited to the
  explicit top-right icon, and the primary workspace now uses the descriptive
  Secure Networking Operations title. Collapsed sections now remove the
  decorative edge beside their approved icon and replace the gray text summary
  with compact SUI KPI and severity badges using the mockup's semantic colors.
  The status atmosphere now comes directly
  from the released SUI <code>SpotLight</code> page-top preset rather than the
  legacy custom gradient, and severity badges use the mockup's 50% fills with
  token-driven readable text. Glass status cards now hug their title, subtitle,
  and value content with tighter subtitle-to-value spacing. The five Secure
  Networking pillars now use the team-approved Splunk React icons consistently
  in the Splunk navigation rail and workspace section headers:
  ShieldKeyhole, Servers, NodeModel, WallBricks, and RobotFaceWrench.
- Insights Workspace no longer renders the floating Splunk copyright badge or
  the branded footer strip, returning that space to the operational canvas.
  Tile configuration now includes an admin-controlled `Use thresholds` switch;
  disabling it removes threshold-derived colours, status icons, and threshold
  guidance while preserving the warning and critical bands for later use.
- Searchbase KPI thresholds now declare an explicit reviewed default. Portable
  health, availability, latency, percentage, and score bands remain enabled;
  raw activity, inventory, and time-range-dependent volume bands are preserved
  but disabled until an administrator calibrates them. Corrected defaults now
  align ISE authentication failure rate with 5%/15% guidance, ThousandEyes
  average latency with 50/100 ms guidance, and average packet loss with 1%/3%
  guidance, alongside tighter AP, compliance, and active-incident bands.
- Insights Workspace tiles can now attach an ordered workflow of up to 24
  Searchbase drill-down searches. Detail dialogs match Dashboard Manager with
  accessible Back/Forward navigation, update Search and Searchbase actions for
  the active target, cancel the previous dispatch when moving, and run only one
  supporting search at a time. Existing single-target configuration remains
  compatible.
- Searchbase searches now directly cover Cisco Catalyst Add-on 3.2.44 current
  and retained sourcetypes for Catalyst Center, ISE, SD-WAN, and NetFlow,
  including discriminator fields for consolidated ISE policy records. The
  documented runtime dependency now requires add-on version 3.2.44 or later.
- Secure Networking Searchbase now includes six Webex trend-and-detail
  workflows for authentication, administrative changes, calling outcomes,
  meeting media health, join time, and contact-center service levels. Direct
  Webex Add-on data uses a dedicated index macro so deployments can tune its
  index scope independently from Cisco Spaces Webex device telemetry, and
  Setup now detects and tunes that macro from indexed Webex sourcetypes.
- Setup package readiness can now refresh the installed-app inventory in place
  after an install or upgrade. Installed packages open a focused Manage Apps
  view, and Searchbase is presented first with an explicit mandatory
  foundation treatment so its dashboard dependency is unmistakable.
- Setup package readiness now presents its live results in the same structured
  status-table pattern as the Cisco package guides, with installed and latest
  known versions, clear state pills, visible package purposes, exact technical
  IDs, and filtered Manage Apps actions in each row.
- Hybrid Mesh Firewalling now includes Palo Alto Traffic by SGT among its
  three factory-visible Insights Workspace tiles while retaining the full
  nine-search section catalogue for operator expansion.
- Setup index tuning now discovers Palo Alto <code>pan:*</code> sourcetypes
  across deployment-specific indexes and maps them to <code>index_firewall</code>.
  Macro source rows also retain readable dark hover and keyboard-focus states.
- Links in every Searchbase guidance metadata field now open in a new browser
  tab from both Insights Workspace and Dashboard Manager, with opener access
  disabled for safe external navigation.
- Insights workspace section drill-downs now open native dashboards through
  Dashboard Manager, preserving its controlled search-dispatch runtime instead
  of loading Dashboard Studio views directly. The contract covers every Secure
  Networking pillar plus the IT Operations, Security Operations, and Workplace
  sections available to alternate workspace presets.
- Insights now uses `workspace_insights.xml` as its single dashboard shell.
  Secure Networking, Zero Trust Access Demo, Network Resilience Demo, Security
  Operations Demo, Executive Briefing, and future custom workspaces all select
  their config-driven preset through `?workspace=<workspace_id>`; the two
  redundant named workspace views and their legacy route mappings are removed.
- Dashboard view IDs and labels now follow one searchable naming convention:
  `sn_` for Secure Networking stories, `workspace_` for bootstrap-powered
  workspaces, and domain prefixes such as `netops_`, `secops_`,
  `workplace_`, and `admin_` elsewhere. Navigation, setup redirects,
  Dashboard Manager deep links, workspace routing, story generation, tests,
  and Searchbase documentation now use the canonical names. Security
  Operations routes deliberately pair `secops_` with the existing `netops_`
  convention. Customer-specific
  exercise and activation-report wording has been replaced with reusable
  Catalyst health and operations labels.
- All 35 dashboards now use the same borderless Cisco Cloud Control atmosphere.
  React and static dashboard shells reference one central blue/violet SVG asset,
  while all 53 native Dashboard Studio layouts embed an exact persisted copy so
  the atmosphere also renders in Studio view and edit modes. The asset contains
  no frame or stroke; React uses cover scaling to avoid seams and Studio uses
  contain scaling to keep the lower atmospheric bloom visible on tall canvases.
  Studio line and
  area charts use the schema-valid outlined marker mode, eliminating editor
  validation errors without changing searches, tokens, inputs, tabs,
  drilldowns, visualization identities, layout geometry, or interactions.
  Cisco Spaces Intelligence also expresses its unchanged 2024–2030 annotation
  window in Splunk 10's accepted ISO format, preventing a console dispatch
  error while retaining the same annotation query and dates. The 1640px
  Workplace canvas now uses Studio's native fit-to-width mode so it no longer
  creates page-level horizontal overflow at common desktop widths. All 25
  native Studio routes now share the same responsive canvas containment beside
  Splunk's application rail.
- All remaining factory light-mode dashboards now use the shared Cisco Cloud
  Control atmospheric dark canvas, opaque operational surfaces, accessible
  typography and controls, semantic status colors, centralized visualization
  palette, and dark table chrome. Existing searches, tokens, inputs, tabs,
  drilldowns, layout geometry, and interactions are preserved, while the React
  operations and guide views retain reversible light, dark, and system theme
  preferences.
- IT Critical Systems Health now uses the shared Cisco Cloud Control
  atmospheric dark canvas, opaque operational panels, accessible dark table
  chrome, and centralized semantic visualization palette across all six tabs,
  while preserving its searches, inputs, tokens, drilldowns, and interactions.
- Dashboard Manager source editing now supports in-editor find and replace via
  the standard Command/Ctrl+F shortcut without loading Monaco's unrelated
  editor features.
- Dashboard Manager now honors Dashboard Studio `hideEdit` metadata and hides
  the View-mode Edit control by default, while explicit `/edit` routes remain
  available for intentional dashboard editing.
- DC Networking Searchbase harvesting now removes trailing title separators
  with a linear scan, eliminating an exponential-backtracking ReDoS path while
  preserving harvested search names.
- Setup and Macro Index Tuning now use the same fixed dark Splunk shell,
  layered C3 atmospheric canvas, charcoal operational panels, restrained
  borders, semantic status tints, and 1CD-themed controls as the Secure
  Networking home workspace.
- Setup is now the single visible administration entry point for readiness and
  index routing. Its restored three-step workflow discovers available customer
  data, explains which dashboard areas will remain unavailable, recommends only
  the relevant apps and add-ons, and embeds full macro tuning as the final step
  without navigating to a second dashboard. Existing tuner deep links redirect
  into the integrated Setup step. Data-center and Meraki sourcetypes now map to
  their correct solution coverage and package recommendations, responsive
  discovery cards no longer compress beside expanded evidence, and the final
  step keeps disclosure and action surfaces consistently dark without changing
  the user's saved app-wide theme preference.
- Setup now marks Searchbase and CIM as required foundations, groups the Splunk
  AI Toolkit with its matching Python runtime, and collapses data-model
  acceleration details into product summaries. Finishing setup saves every
  detected dashboard, installed Cisco-app, and CIM routing macro before marking
  the app configured, with visible row-level errors when any write fails.
- Primary navigation now keeps Home and the five Secure Networking pillars in
  focus while consolidating secondary destinations under More. Dashboard
  Manager is the first emphasized action, followed by operational dashboard
  groups, Help and Resources, visual labs, and administration; experimental
  destinations remain explicitly marked as beta.
- Dashboard Manager drilldowns now use the same compact glass dialog, bounded
  scrolling, header-level Search and Searchbase actions, and collapsible
  guidance treatment as Insights Workspace. Short result tables use a tighter
  canvas, and inline SPL fields use high-contrast monospaced code styling
  instead of low-contrast red text.
- All 16 five-pillar Dashboard Manager views now use the approved compact
  header template, with the 4h/24h/48h/7d/30d picker, larger Insights
  Workspace typography, C3 graph palettes, and no-red semantic KPI trends.
  Each dashboard still shares one Searchbase dispatch between a headline and
  its supporting graph, keeping initial load bounded to six searches. The five
  pillar summary dashboards are restored to their navigation menus with
  distinct posture, readiness, enforcement, and operations labels. Menu names,
  Dashboard Studio titles, and visible header titles now stay synchronized
  across all 16 views, including the shortened Executive Assurance title.
- Five-pillar Dashboard Studio stories no longer dispatch feed-freshness
  monitors. Operational Intelligence now leads with ThousandEyes healthy and
  degraded test counts, while Executive Assurance retains device-health and
  data-source detail without linking to the consolidated freshness matrix.
- Searchbase contextual drilldowns now use target stanza IDs instead of mutable
  `search_name` labels. All 401 shipped relationships were migrated and are
  validated for exact target existence, while existing local configuration and
  browser-persisted friendly-name overrides continue to resolve during the
  compatibility window. New admin edits write the canonical
  `drilldown_stanza_id` field and clear the deprecated key.
- Insights Workspace H1 tiles now use height-aware compact sparklines that
  dedicate the available canvas to the trend, retain hover detail, mark the
  latest point, and apply bounded scale padding without exaggerating flat
  data. Each section can be collapsed to a KPI and health summary or focused
  as the primary work surface; factory sections remain expanded, collapse
  preferences stay private to the workspace, and focus mode is temporary.
- Secure Networking visualizations now use a C3-observed operational palette
  across Insights Workspace trends, ranked bars, gauges, topology status, and
  all 16 Dashboard Studio stories. Information blue, healthy green, caution
  yellow, critical red, orange, and supporting lavender/cyan tones replace
  saturated framework defaults; area fills, dark card surfaces, borders,
  elevation, and the factory atmospheric background are also quieter and
  closer to Cisco Cloud Control. The app continues to use Splunk's 1CD theme
  customizer as its component foundation.
- Secure Networking Insights Workspace searches now replace unsupported
  Unknown dimensions with real site, NAD, ISE-node, source-layer, telemetry
  coverage, or per-test context; bound high-volume drilldowns to deterministic
  top results; correct ThousandEyes latency units; and reduce firewall trend
  cardinality. All 45 profile cards, six Signal Rail items, and two map KPIs
  now carry ordered numeric warning and critical thresholds plus guidance.
- The experimental Searchbase SPL anti-pattern linter no longer blocks normal
  app packaging by default. Focused catalogue reviews can still opt in with
  `./build.sh --lint-spl-antipatterns`, while valid searches that intentionally
  depend on ordering or carefully scoped `dedup` and `fillnull` semantics are
  left for human review.
- Insights Workspace dark profiles now use a Cisco Cloud Control-inspired
  atmospheric canvas with layered navy, near-black, and violet depth instead
  of a flat page fill. Mostly opaque charcoal toolbars, Signal Rail chrome,
  metric sections, topology panels, and footer surfaces preserve dense-data
  contrast while softer borders and sentence-case structural headings bring
  the content surface closer to the shared Cisco visual language.
- Dashboard Manager now lists the matching Cisco Cloud Control Atmosphere
  artwork first in its background selector and uses it for newly created
  dashboards. All 25 factory Dashboard Studio views and their 53 layouts ship
  with the same borderless background and near-black fallback canvas.
- The Insights Workspace theme toggle now inherits the same explicit
  high-contrast light, dark, and hover colors as adjacent toolbar controls, so
  its sun, moon, and automatic-theme icons remain visible in every mode.
- Insights Workspace detail drilldowns now share Dashboard Manager's
  Searchbase guidance contract while retaining their compact, resizable glass
  shell. The modal identifies the active supporting search and classification,
  adds expandable Description, Explanation, Solution, Related information, and
  Execution plan content, and keeps dispatch bounded to one cancellable,
  1,000-row search with no additional catalogue request. Result tables now
  follow their content height for short searches and become internally
  scrollable at a bounded height for long searches, keeping the guidance region
  visible and consistent without a large empty table surface.
- Detail drilldowns now place Searchbase beside Search in the dialog header
  and remove the decorative search glyph from the supporting-search summary.
  Configure Tile keeps View in Searchbase and Test in Search visible directly
  beneath the currently bound search, so operators do not need to find the
  selected row before validating or learning about its SPL.
- The development `--deploy` workflow now preserves live runtime lookup CSVs
  alongside `local/` during its filesystem swap. Lookup-backed background
  searches therefore remain dispatchable after a fast deployment instead of
  waiting for their saved-search generators to recreate mutable CSVs. Fast
  packaging also excludes watcher-linked runtime CSVs that are not present in
  the source resource tree, keeping generated instance state out of tarballs.
- Insights Workspace dialogs now include a persistent Backdrop opacity slider
  in the desktop header. Operators can tune workspace dimming from 0–100%
  without changing the dialog, table, or chart content.
- Signal Rail pause, style, and configuration controls now stay hidden and
  non-interactive until the rail is hovered or keyboard-focused. The controls
  float outside the ticker layout and use translucent, transparent chrome so
  all available width remains dedicated to the signal tiles.
- The Secure Networking command topology now supports cursor-anchored wheel
  and trackpad zoom, drag-to-pan, keyboard navigation, visible zoom controls,
  and one-click fit-to-view. Navigation stays bounded and updates one SVG
  viewport transform per animation frame for smooth interaction as maps grow.
- Dashboard Manager now starts its view-mode toolbar folded so dashboards get
  the maximum available canvas width by default; the existing edge control can
  still expand it on demand.
- All 16 Secure Networking Dashboard Studio views now tell a consistent
  six-KPI story in a clean dark three-by-two card layout. Every card pairs a
  current value with a trend or categorical graph, shows its Searchbase
  category and sub-category, and opens one or more ordered supporting searches
  as an in-dashboard drilldown instead of placing detail tables on the main
  canvas. The shared data source for each value/graph pair bounds every
  dashboard to six initial searches, down from 131 panels across the suite to
  96 card searches, while drilldown searches continue to dispatch only when
  visible.
- Searchbase now includes 12 bounded trends needed to complete the Secure
  Endpoint, XDR, Attack Analyzer, and remote-access VPN stories. These searches
  use at most 60 time buckets and capped dynamic series, and the existing RaVPN
  connection-rate search now renders as a bounded area trend with an ordered
  session-profile drilldown.
- Infrastructure ISE Network Device Count now opens two in-dashboard details:
  ZTA RADIUS Node Health by Site and ZTA ISE Auth Failure Rate by Network
  Device. Dashboard Manager presents the ordered searches with Back/Forward
  navigation, Searchbase visualization metadata and actions, and the active
  dashboard time range while dispatching only the visible search.
- Dashboard Manager now handles internal Dashboard Studio `/drilldown` links
  in place, resolves their Searchbase targets, and opens the selected detail
  search with the dashboard's active time range. Drilldown triggers use the
  same open-details-panel icon as the home dashboard, and multiple targets load
  one at a time instead of dispatching in parallel.
- Signal Rail settings now show a disabled green `Using workspace default`
  confirmation when the active configuration matches the workspace preset. The
  control becomes an enabled red `Restore workspace default` action only after
  a customization, making both the reset and its immediate result visible.
- Segmentation Overview now renders IP-SGT binding results as a paginated
  drilldown table, and Dashboard Manager describes its Searchbase catalogue
  action as adding reusable searches instead of visualizations.
- Secure Networking Dashboard Studio cards now use 84 area charts, six bars,
  four columns, and two pies with high-contrast sky, cyan, emerald, amber,
  orange, rose, violet, teal, and slate series colors. Categorical searches keep
  an appropriate comparison chart while continuous signals use bounded area
  trends.
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
- All 16 Secure Networking canvases now use compact headers and exactly six
  narrative cards in a three-by-two layout. Each card shares one Searchbase
  dispatch between its current value and lower graph, with the supporting
  detail searches reserved for drilldown navigation.
- Every Secure Networking story card now includes a current single value and a
  best-fit historical or categorical graph, with concise decision-oriented copy
  and a small Searchbase category and sub-category label.
- Secure Networking visualization fixes now plot SD-WAN site coordinates on a
  world view, supply the Segmentation binding pie with a strict category/value
  result shape, and present ISE RADIUS latency with concise node labels,
  bounded series, connected samples, and millisecond axis labeling.
- All 16 Secure Networking Dashboard Studio views use a Cisco-inspired
  dark-mode information hierarchy with purpose-led headers, readable slate
  surfaces, bright data colors, and the same open-details interaction used by
  the Insights Workspace home dashboard.
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
