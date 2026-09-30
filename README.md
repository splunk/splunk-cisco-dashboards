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

Splunkbase release tarballs are written to `dist/`. Developer artifacts go to
`dist/developer/`, and previews go to `dist/preview/`. Normal packaging uses
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
readable artifacts anywhere under `dist/`, including `dist/archive/` and the
profile directories. The installation target never influences package
construction.
The [`releases/splunkbase-9257.json`](releases/splunkbase-9257.json) ledger is
historical publication evidence and a safe build floor; it is not a manual
pre-build allocation step. Every package allocates above the ledger's greatest
recorded build even when `dist/` is empty. Keep verified release history in
this ledger before discarding artifacts; allocation cannot recover unrecorded
builds once their archives are deleted.
Artifacts use the operator-readable name
`splunk-cisco-dashboards-<version>-<build>.tar.gz` (plus `-developer` for an
explicitly selected developer profile, or `-preview` for a Splunkbase preview).
This tarball is the only package file emitted. Packaging re-extracts and
validates it before publication, and the root build wrapper verifies its
filename identity and gzip integrity before use.
A successful Splunkbase build always requires clean committed source and emits
a release-eligible archive. Adding `--install --splunkbase` or `--deploy --splunkbase`
applies that exact archive after packaging without changing its identity or
provenance. Uncommitted `./build.sh --install` runs select the developer
profile automatically so local iteration can proceed before a commit.
`./build.sh --splunkbase-preview` applies the same released-resources-only
filter to an uncommitted worktree for local content inspection. It keeps the
resources listed under `previewRetained` in
`config/build-profile-manifest.json`, which currently carves out the Searchbase
Canvas authoring surface so a preview can still be used to inspect the
catalogue it is previewing. Everything else developing is removed exactly as it
would be for a release. Its archive records `release_eligible: false`, and both
the release gate and release-profile installer reject it even if it is renamed
into the release namespace. Do not upload previews or developer packages to
Splunkbase; the portal is outside these local safeguards.

Before uploading, check the exact file you intend to select:

```bash
./build.sh --verify-release dist/splunk-cisco-dashboards-<version>-<build>.tar.gz
```

This read-only check validates gzip integrity, filename and embedded identity,
and clean release provenance, then prints the archive's SHA-256. It rejects
previews and developer packages, including renamed previews. It does not build,
install, run AppInspect, or prove update discovery. After publication, compare
the downloaded archive's SHA-256 with this value, since Splunkbase renames the
download. Verify the Update link separately on an eligible older installation.

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
