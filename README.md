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

For single-command packaging, run `./build.sh`; missing build dependencies are
installed automatically. For optional manual development setup, install from
the repository root:

```bash
yarn install
```

Installation automatically applies the maintained
[`braces` security patch](patches/braces+3.0.3.patch) and fails if it cannot
be applied. Do not use `--ignore-scripts`: it skips this protection.
The patch bounds brace/parenthesis nesting and AST traversal at 100 levels,
including cyclic AST parent chains. It preserves ordinary build-tool glob
patterns and mitigates GHSA-vfj7-8cjw-p6xm until an upstream fix is released.
Dependabot can still report the upstream `braces@3.0.3` version because it
does not account for local patches. Run `yarn test` to verify the mitigation
and the patched dependency-version floors.

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
output. Each package reserves a repository-wide number using GitHub Actions
before installing missing dependencies or compiling. Numbers continue across
VERSION changes. Existing archives and release history are safety floors;
they never allocate a number locally. The installation target has no influence.

**Activation required:** `.github/workflows/reserve-build-number.yml` must reach
GitHub's default branch (`main`) and Actions must permit it to run. A push to a
development branch alone does not activate dispatch. Developers can subsequently
build from development branches. No live reservations were performed during
implementation. Until activation, packaging deliberately fails before compilation.

The canonical repository is `splunk/splunk-cisco-dashboards`. Keep the workflow
filename, run-name prefix and permanent offset **2113** unchanged. GitHub assigns
`run_number`; package build = 2113 + run_number, starting at 2114 above all known
retained archives. Never recreate/reset the workflow or use a fork's counter.
Before activation, reconcile any builds produced by other machines above 2113.
The [`release ledger`](releases/splunkbase-9257.json) remains historical evidence.

Install Node.js >=20, Python 3, Yarn Classic 1.22.22 (or Corepack), and GitHub CLI;
sign in with `gh auth login --hostname github.com` using repository/Actions write
access. `./build.sh` installs missing compilation dependencies, including dev
packages, with `yarn install --frozen-lockfile --production=false --non-interactive`.
It never updates the lockfile or package-manager configuration. Installed build
dependencies are reused. Postinstall security patches remain enabled.

Each request has a UUID and matches its own workflow run, even with concurrent
clients. Intent and reservation receipts are retained under
`dist/build-reservations/`; a reservation is atomically claimed once before a
package attempt. Failed/cancelled builds spend numbers. A lost dispatch response
is uncertain: inspect its request receipt and GitHub run; never resubmit the same
identity. Start a new build with a new identity instead. Do not delete claim files
or copy receipts to reuse a number. No local fallback or manual override exists.
Concurrent builds in one checkout fail at `.packaging.lock` to protect stage/;
independent checkouts reserve concurrently. Inspect stale locks before removal.

`--no-build` reuses a verified existing package without contacting the allocator.
A newly built archive's exact path is returned directly to installation/deployment,
so another client's newer archive cannot replace the selected output.

Build date stamps affect generated release metadata only. Package build numbers,
application VERSION and independently published catalog revisions remain separate;
catalog publication formats and older sync-command compatibility are unchanged.

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
