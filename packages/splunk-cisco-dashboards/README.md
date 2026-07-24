# @splunk/splunk-cisco-dashboards

React-based Splunk app that ships four dashboards for Cisco data:

| View      | Purpose                                                                 | Stack                          |
| --------- | ----------------------------------------------------------------------- | ------------------------------ |
| Overview  | Executive Control Center — branded title/logo, three-section layout, regional map | TypeScript, Tailwind, Leaflet, Recharts, Motion |
| Devices   | Inventory + per-device status badges (filterable)                       | `@splunk/react-ui`             |
| Network   | Aggregate bandwidth time-series + per-device CPU bars                   | `@splunk/react-ui`             |
| Security  | Severity KPIs, time-window selector, alert timeline                     | `@splunk/react-ui`             |

> The Overview dashboard is a faithful port of the design in
> `reference_design/splunk-executive-florida-dashboard/` (Vite + React 19 +
> Tailwind v4 + react-leaflet v5 + recharts v3). It has been adapted to
> the Splunk app build pipeline: React 19, Tailwind v3, react-leaflet v4,
> recharts v2 (the latter two stay on their react-18-peer majors to avoid
> breaking-API rewrites; they work fine on React 19 with peer warnings).
> Visual output is identical.

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

Each view is a Simple XML dashboard whose only panel is an `<html>` block
containing `<div id="scan-root">`. A small RequireJS bootstrap (in
`appserver/static/<view>_bootstrap.js`) loads the matching React bundle
from `appserver/static/pages/<view>.js`, which mounts into `#scan-root`.

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
        │   │   │   ├── florida/  # DashboardSection, MetricItem, Sparkline, CustomerTopologyMap
        │   │   │   └── *.jsx     # @splunk/react-ui based shared cards
        │   │   ├── hooks/        # useSplunkSearch
        │   │   ├── lib/          # cn() and other utilities
        │   │   ├── services/     # splunkSearchService (SPL allow-list + mock)
        │   │   ├── styles/       # tailwind.css (scoped)
        │   │   ├── types.ts
        │   │   ├── render.jsx    # @splunk/themes mount helper
        │   │   └── render-raw.tsx# bare mount helper (Tailwind dashboards)
        │   └── pages/
        │       ├── overview/{index,render}.tsx   # Florida Executive design
        │       ├── devices/{index,render}.jsx
        │       ├── network/{index,render}.jsx
        │       └── security/{index,render}.jsx
        └── resources/
            └── splunk/
                ├── default/
                │   ├── app.conf
                │   └── data/ui/{nav,views}/
                ├── appserver/static/      # bootstrap loaders
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
package as a tarball.

## Production build & packaging

```bash
yarn build                   # webpack build → ./stage
node bin/build.js pack       # build + tar → ./splunk-cisco-dashboards.tar.gz
```

## Mounting model

Each Simple XML view contains:

```xml
<dashboard version="1.1" hideEdit="true" hideExport="true" hideTitle="true"
           script="overview_bootstrap.js">
    <label>Overview</label>
    <row>
        <panel>
            <html>
                <div id="scan-root"></div>
            </html>
        </panel>
    </row>
</dashboard>
```

`overview_bootstrap.js` is a 4-line RequireJS shim:

```js
require(['/static/app/splunk-cisco-dashboards/pages/overview.js'], function () {});
```

That bundle calls `mountPage(<PageComponent>)`, which retries until
`#scan-root` exists (Splunk Web's RequireJS sometimes runs ahead of the
panel) and then renders inside a `SplunkThemeProvider`.

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
