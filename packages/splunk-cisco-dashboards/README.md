# @splunk/splunk-cisco-dashboards

Splunk app for Cisco data that combines React workspaces with native
Dashboard Studio views. The main React entry points cover Insights,
health monitoring, topology, searchbase authoring, operations, guidance,
and dashboard management; the packaged Studio views cover the secure
networking pillars and workplace scenarios.

## Release notes

### 1.1.0

- **Ask AI (Preview):** Describe what you want to monitor to find existing Searchbase searches. Review the top five matches first and select **Show more results** to see the next five. Expand **Search details** for available explanations and solutions, or **View SPL** for color-coded SPL. Use **Open in Search** to run a match or **Open in Searchbase** to view its saved entry. If Searchbase is unavailable, use the Splunkbase listing for installation instructions. In a workspace, choose a section to enable **Add for me** and, if you manage the workspace, **Add for everyone**. Hover over or focus either button for details. This preview uses the Searchbase catalogue to find matches. SPL generation is planned for a later version.
- **Workspace drilldowns:** Open a tile’s drilldown to view full-height results. Switch between named views when there are related searches, or open **Search guidance** for the active view. Returning to results restores your table sort and scroll position.

### 1.0.90
- **New dashboards:** DC Networking Operations, Catalyst Operations (Preview), and Security Operations Overview (Preview).
- **Better workspaces:** Cleaner Signal Rails, maps, charts, and layouts, with shared visualization defaults.
- **More reliable metrics:** Corrected client-health totals, filters, and missing-data handling.
- **Improved investigations:** More accurate DNS, VPN, firewall, SGT, syslog, and transfer-data results and drill-downs.
- **Easier configuration:** Smoother dashboard creation and improved Infoblox index discovery.
- **Better usability:** Readable User Guide formatting, clearer chart labels, and improved keyboard and theme support. The Workspace header shows the build loaded in the browser so you can verify an update after refreshing.

See the in-app **User Guide** for earlier releases, upgrade actions, and configuration instructions.

## Runtime prerequisites

- Cisco Enterprise Networking Add-on for Splunk 3.2.44 or later. This version
  is required for the current and retained sourcetype coverage used by the
  packaged searches and accelerated data-model constraints.

When choosing a data source, use CIM when it preserves the required semantics,
use Cisco app or add-on models for vendor-specific fields, and retain raw searches
when the available data models cannot represent the search accurately. Review
data-model readiness in **Setup > Tune CIM models**.

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
operator. Packaging reserves a shared GitHub Actions build before compilation
and stamps it into generated output. History and archives are safety floors.
The canonical workflow requires activation on GitHub’s default branch; see the
[root build-number documentation](../../README.md#installation). The
installation target does not influence package allocation. The committed ledger at
[`../../releases/splunkbase-9257.json`](../../releases/splunkbase-9257.json) is
publication history and a build floor, not a manual `current` allocation.
Successful packages are named
`splunk-cisco-dashboards-<version>-<build>.tar.gz` (plus `-developer` for an
explicit developer profile, or `-preview` for a Splunkbase preview). That
tarball is the only emitted package file; packaging validates it internally, and
the root build wrapper verifies its filename identity, gzip integrity, and
release-eligible provenance before use.
A successful `./build.sh --install --splunkbase --auth user:password` run
installs the exact upload-ready tarball it creates. Splunkbase builds require a
clean committed worktree. Uncommitted `./build.sh --install` runs select the
developer profile automatically so local iteration does not require a commit.
`./build.sh --splunkbase-preview` keeps the released-resources-only filter on an
uncommitted worktree and writes a `-preview` tarball marked
`release_eligible: false`, which the release and install gates always reject.
Resources listed under `previewRetained` in `config/build-profile-manifest.json`
survive that filter; it currently carves out the Searchbase Canvas authoring
surface. Entries there must also be declared developing, so the carve-out can
only ever shrink what a preview removes, never add something that always ships.

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
