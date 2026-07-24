# Splunk Cisco Dashboards

A Yarn-workspaces monorepo housing the **Splunk Cisco Dashboards** Splunk
app — a React-based set of dashboards (Overview, Devices, Network,
Security) that visualize Cisco fleet, network performance, and security
data inside Splunk Web.

## Layout

```
splunk-cisco-dashboards/
├── package.json          # workspace root
└── packages/
    └── splunk-cisco-dashboards/   # the actual Splunk app + React UI
```

The top-level scripts simply delegate into the package:

```bash
yarn install              # install workspace deps
yarn setup                # install + build everything
yarn start                # webpack --watch in the app package
yarn build                # production build of all packages
yarn lint                 # eslint + stylelint
yarn clean                # remove build artifacts
```

For more detail see [`packages/splunk-cisco-dashboards/README.md`](packages/splunk-cisco-dashboards/README.md).

## Installation

Install workspace dependencies from the repository root:

```bash
yarn install
```

To build the Splunk app package locally:

```bash
yarn package:app
```

The packaged Splunk app tarball is written to `dist/`.

For a smaller, minified release package (slower to build):

```bash
./build.sh --minify
```

Minification is opt-in and does not affect the fast `yarn start` watch workflow.

## Usage

For local development, run the app package webpack watcher:

```bash
yarn start
```

For a production build across the workspace:

```bash
yarn build
```

The actual Splunk app source, dashboards, and packaging scripts live in
`packages/splunk-cisco-dashboards/`.

## License

Copyright 2026 Splunk Inc.

Licensed under the [Apache License, Version 2.0](LICENSE). See
[NOTICE](NOTICE) for attribution information.
