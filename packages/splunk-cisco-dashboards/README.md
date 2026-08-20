# @splunk/splunk-cisco-dashboards

Splunk app for Cisco data that combines React workspaces with native
Dashboard Studio views. The main React entry points cover Insights,
health monitoring, topology, searchbase authoring, operations, guidance,
and dashboard management; the packaged Studio views cover the secure
networking pillars and workplace scenarios.

## Runtime prerequisites

- Cisco Catalyst Add-on for Splunk 3.2.44 or later. This version is required
  for the current and retained sourcetype coverage used by the packaged
  searches and accelerated data-model constraints.

The Insights Workspace uses the shared components in
`common/components/workspace/`, including KPI tiles, workspace dialogs,
signal rails, and the customer topology map. Search metadata remains
centralized in `default/searchbase.conf`.

## Branding (customer name + logo)

The home dashboard (`home_launchpad_v1`) and the React Overview both pull
the customer name from a single Splunk macro called `customer_name`,
defined in `default/macros.conf`:

```ini
[customer_name]
definition = "Acme Corporation"
iseval = 1
```

Override the default in `local/macros.conf` per deployment.

The Overview ships with a neutral inline network mark as its default logo.
To brand a deployment, use the header editor to upload a logo; the override
is stored in the browser as a data URI. Title can still be set globally via
`customer_name`.

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
│   └── build.js                  # webpack + stage + tarball orchestrator
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
package as a `.spl`/tarball. The development stage contains both released and
developing app resources; release filtering happens only in temporary package
staging.

## Production build & packaging

```bash
cd ../..
./build.sh                    # Splunkbase: released resources only
./build.sh --developer        # local: released + developing resources
./build.sh --minify           # slower, minified Splunkbase package
```

Minification is opt-in; normal builds and `yarn start` keep fast,
unminified production-React bundles.

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

* SPL strings are validated against an allow-list before they ever reach
  the search runtime — defense-in-depth against accidental or malicious
  injection through string concatenation.
* The Security page time-window selector is allow-listed with an
  enumerated list and re-validated before the search params are formed.
* No Splunk credentials are held by the client — Splunk Web manages auth
  via HttpOnly cookies; the app never touches `localStorage`.

## License

Copyright 2026 Splunk Inc.

Licensed under the [Apache License, Version 2.0](../../LICENSE). See
[NOTICE](../../NOTICE) for attribution information.
