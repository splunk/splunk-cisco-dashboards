# Maintainer build numbering

This is engineering guidance, not customer release documentation. Package names,
VERSION handling, profile suffixes and installation defaults are unchanged.

## Shared sequence

The canonical service is `github.com/splunk/splunk-cisco-dashboards`, Git reference
`refs/build-reservations/counter`. It is an append-only commit chain whose records
identify this repository, a build number and a request UUID. Writers use the
current commit as parent and update the ref with `force=false`. Racing siblings
are rejected and retried (at most eight attempts, a 120-second allocation budget,
20 seconds maximum per request). A timeout/uncertain write is never retried as if
it failed. Pending intent is persisted before publication, so even manual fallback
must exceed a potentially consumed number. Local disk failures remain fatal.

Numbers continue across versions, profiles and machines. The permanent historical
floor is **2113**; the legacy Actions allocator used `2113 + run_number`. Do not
copy a different project's repository, floor or counter. Never reset or force-update
the shared ref, and never select a fork's sequence. `gh` uses its existing sign-in;
Contents write access is sufficient after migration. Normal allocations do not
query, dispatch or wait for Actions.

## Automatic first-build transition

Run the normal build command on any workstation. No activation command, copied
reservation file or manually selected number is needed when shared access works.
A fresh workstation creates `dist/build-reservations/current.json` automatically.
A missing/corrupt cache uses the existing shared counter and metadata floors.

If this project's Git counter has not yet been created, the first normal build:

1. Reads the existing canonical Actions workflow identity and sequence.
2. Disables that allocator automatically so older clients cannot keep issuing
   overlapping numbers. It verifies retirement and samples the accepted dispatch
   history until its run-number snapshots settle, within the allocation timeout.
   It does not wait for any Actions runner or reservation job to execute.
3. Creates the project Git counter above the legacy and available metadata floors
   using concurrency-safe reference creation. Competing first-time clients retry
   against the winning counter, then each reserves a distinct next number.

This initial transition needs Actions write access to retire the old allocator;
afterward normal builds need only Contents write access and do not query Actions.
A permission/service failure uses the existing coordinated manual fallback rather
than an activation/setup prompt. Update developer checkouts to use the new tooling;
do not re-enable the retired old allocator. The legacy sequence and history are
preserved. The optional `--initialize-counter` helper flag remains compatible but
is unnecessary for normal builds.

Local cache deletion never deletes the shared counter. If a workstation has
previously observed the Git counter and the server subsequently reports it missing,
it refuses to reset that history. Recover a lost server ref rather than treating
it as new. Tests simulate the first-build transition and independent workstations;
local source validation does not itself change or qualify the live shared service.

## Local state and recovery

There is exactly one persistent reservation state file:
`dist/build-reservations/current.json`, ignored by Git through `dist/`. It records
repository, build, backend, request identity and reserved/pending/claimed status.
Writes use same-directory temporary files, fsync and atomic replacement. Each
number is claimed once before dependency installation or compilation. Failed or
cancelled attempts spend it. Never edit claimed status to reuse a number.

Missing/corrupt local JSON or its entire directory is recoverable. Allocation
consults the authoritative counter plus source app.conf, the release ledger,
every retained app archive under dist/ (all profiles, versions, `.tar.gz` and
`.tgz` suffixes), selected installed app.conf, staged app.conf and known higher
local state. It reads embedded metadata rather than trusting archive filenames.
Malformed retained packages, unreadable metadata or disk errors fail normally;
manual fallback does not suppress them. If service/history evidence is unavailable,
no globally unique number is guessed: coordinate a manual one.

Old numeric `.json`/`.claimed` and `request-<UUID>.json` receipts, including those
inside recognized `migration-through-<build>` directories, are consolidated
only after retaining their highest known floor. Recognized stale atomic temporary
files are cleaned up under the state-directory lock. Unrelated files and package
history remain untouched. Normal builds perform this cleanup automatically. For offline maintainer-only
consolidation without allocating a number, the helper also supports
`--migrate-state --receipts dist/build-reservations` with the normal metadata
arguments shown by `--help`. Recovered floor-only state is consumed and
cannot be claimed for a package.

The directory inode is locked for reservation/claim updates without another
persistent lock file. This does not make the stage/dependency/output pipeline
safe for parallel builds within a checkout. Its existing `dist/.packaging.lock`
continues to require one build at a time. Independent checkouts may reserve
concurrently. Inspect a stale packaging lock before removing it.

## Outages and explicit numbers

If shared allocation cannot be established (CLI/authentication/network/service
failure, Actions unavailable during the initial transition, or loss of a previously
observed remote counter),
the interactive packager prompts on `/dev/tty`. The prompt remains visible even
when build.sh captures stdout/stderr. Enter an explicitly coordinated integer
above the reported floor; it is marked `backend=manual`, not shared/verified.
Global uniqueness cannot be verified offline. Coordinate these numbers across
developers; retain manual state/artifacts until the next shared reservation
advances past them.

For a deliberate unattended override:

```sh
SCD_BUILD_NUMBER=<coordinated-number-above-known-floor> ./build.sh --developer
```

An explicit override takes precedence, is validated against available local and
package/installed history, and does not contact the allocator. It therefore always
requires coordination, even when the remote service is online. Empty, nonnumeric,
non-increasing or previously consumed values are rejected. No usable service and
no override in CI/no controlling terminal exits with actionable instructions.
This fallback does not ignore compilation, dependency, packaging or install
failures. `--no-build` continues to reuse the verified selected archive without
reserving a number.

## Validation

Run `python3 -m unittest discover -s scripts -p 'test_*build*.py'` and
`NODE_OPTIONS=--max-old-space-size=4096 node scripts/test_build_deploy_contract.cjs`.
Tests use a simulated fast-forward service and temporary checkouts, including
racing writers/claims, cache deletion/corruption, migration/legacy floors,
metadata recovery across versions/profiles/suffixes, uncertain writes, atomic
write interruption/cleanup, outages, invalid/manual CI overrides and a real
controlling-terminal prompt with captured stdout/stderr. They do not consume
production build numbers, deploy, restart Splunk or qualify a full package build.
