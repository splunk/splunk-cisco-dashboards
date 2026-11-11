# Memory safety

- Run Node commands with `NODE_OPTIONS=--max-old-space-size=4096` unless the user approves a higher limit.
- Before a long or data-heavy job, estimate memory use. Stream or sample data; do not load whole datasets into memory.
- Run long commands with a timeout and check their process-tree RSS every 2–3 seconds. Stop any process started for the task if it exceeds 4 GB, and tell the user.
- When a task ends, stop background processes started for it, including dev servers, watchers, workers, and persistent runtimes. Check for orphaned child processes.
- Avoid large temporary files and repeated rewrites. Tell the user before starting a job expected to write more than about 1 GB.
- Use `~/bin/memguard` for heavy commands. It must monitor only the process group it starts, default to a 4 GB RSS limit, accept a configurable limit, and stop that group if the limit is exceeded.


# Customer documentation

- Keep release notes, including historical entries, focused on customer capabilities, fixes, compatibility, supported runtime configuration and required upgrade actions.
- Do not add notes about repository changes, build scripts, branch/commit workflow, build allocation, version stamping, tests, packaging or publication tooling. Maintain those instructions in maintainer documentation outside release notes.
- Keep the in-app guide version and newest release entry aligned with VERSION. Preserve customer-relevant historical changes, upgrade actions and support version/build identifiers.
- Review both the package README release-notes section and the in-app User Guide history; run the customer documentation contract before delivery.
