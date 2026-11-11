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

## One-time migration from Actions

Older clients spend numbers from workflow run_number even if the job fails.
They cannot safely coexist with the new Git allocator. Coordinate all developers:

1. Stop old allocator clients and disable the canonical
   `reserve-build-number.yml` workflow. Wait for outstanding dispatches to settle;
   audit their numbers and any coordinated manual allocations.
2. Preserve workflow history and the 2113 offset. With all known archives and the
   installed target available, initialize the Git counter explicitly:

   ```sh
   python3 scripts/reserve_package_build.py --initialize-counter \
     --receipts dist/build-reservations \
     --app-conf packages/splunk-cisco-dashboards/src/main/resources/splunk/default/app.conf \
     --release-ledger releases/splunkbase-9257.json --dist dist \
     --stage-app-conf packages/splunk-cisco-dashboards/stage/default/app.conf \
     --target-app-conf "$SPLUNK_HOME/etc/apps/splunk-cisco-dashboards/default/app.conf"
   ```

   Set SPLUNK_HOME to the intended instance and unset SCD_BUILD_NUMBER first.
   Initialization fails if shared access is unavailable; a manual number cannot
   initialize a shared counter. A successful initialization spends one reservation;
   a subsequent normal build reserves a higher number. Initialization requires
   readable legacy history and an explicitly disabled workflow. It refuses active
   old allocators. It does not enable/disable workflows itself.
3. Use the new tooling on all machines. Do not re-enable legacy allocation.

An ordinary build never initializes/recreates an absent remote counter. It offers
the coordinated manual path instead. If the ref is ever lost, recover its original
history with maintainer review rather than treating it as a fresh counter. This
change's local tests simulate service writes; committing the tooling does not
activate or prove a live service migration. No workflow/service mutation is
required merely to run the tests.

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
history remain untouched. To consolidate an existing local checkout without
spending a new number, use the same metadata arguments above with `--migrate-state`
in place of `--initialize-counter`. Recovered floor-only state is consumed and
cannot be claimed for a package.

The directory inode is locked for reservation/claim updates without another
persistent lock file. This does not make the stage/dependency/output pipeline
safe for parallel builds within a checkout. Its existing `dist/.packaging.lock`
continues to require one build at a time. Independent checkouts may reserve
concurrently. Inspect a stale packaging lock before removing it.

## Outages and explicit numbers

If shared allocation cannot be established (CLI/authentication/network/service
failure, Actions unavailable during initial migration, or missing remote counter),
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
