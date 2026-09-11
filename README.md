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

Splunkbase packaging always minifies; `--minify` is optional there and remains
explicit for developer builds. It does not affect the fast `yarn start` watch
workflow.

For a release, edit only the root [`VERSION`](VERSION) file and run the build.
Source `app.conf` and `app.manifest` intentionally retain `0.0.0`/`0`
placeholders. Packaging stamps VERSION and the release date into generated
output, then automatically allocates the next build above release history and
readable `dist/` artifacts. The installation target never influences package
construction.
The [`releases/splunkbase-9257.json`](releases/splunkbase-9257.json) ledger is
historical publication evidence and a safe build floor; it is not a manual
pre-build allocation step.
Artifacts use the operator-readable name
`splunk-cisco-dashboards-<version>-<build>.tar.gz` (plus `-developer` only for
an explicitly selected developer profile). This tarball is the only package
file emitted. Packaging re-extracts and validates it before publication, and
the root build wrapper verifies its filename identity and gzip integrity before
use.
A successful Splunkbase build always requires clean committed source and emits
a release-eligible archive. Adding `--install` or `--deploy` applies that exact
archive after packaging without changing its identity or provenance. Use
`--developer` or `--fast` for intentional uncommitted local changes.

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
