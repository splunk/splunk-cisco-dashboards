# Splunk Secure Networking Essentials

A Yarn-workspaces monorepo housing the **Splunk Secure Networking Essentials** Splunk
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
The tracked production-hardening backlog is documented in
[`packages/splunk-cisco-dashboards/CODE_PROTECTION.md`](packages/splunk-cisco-dashboards/CODE_PROTECTION.md).

## Installation

Install workspace dependencies from the repository root:

```bash
yarn install
```

To build the Splunk app package locally:

```bash
yarn package:app
```

The packaged Splunk app tarball is written to `dist/`. Normal packaging uses
the Splunkbase app profile. For a local developer artifact, use:

```bash
./build.sh --developer
```

For a smaller, minified release package (slower to build):

```bash
./build.sh --minify
```

Minification is opt-in and does not affect the fast `yarn start` watch workflow.

Release identity is controlled by the committed
[`releases/splunkbase-9257.json`](releases/splunkbase-9257.json) ledger and
the source `[install] build` in `default/app.conf`. Before each Splunkbase
release, append one strictly higher `current` build allocation, change both
the app version and build in source, and change the preceding `current`
allocation to `published` after public confirmation or `retired_candidate`
otherwise. Packaging rejects metadata that does
not match this ledger, as well as a second archive with the same packaged
version and build within one Splunkbase or developer profile.
Artifacts are content-addressed as
`splunk-cisco-dashboards-<version>-sha256-<digest>.tar.gz` with a matching
immutable `.sha256` sidecar. The root build wrapper verifies both before it
will use an archive, so retain both files used for a Splunkbase upload.

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
