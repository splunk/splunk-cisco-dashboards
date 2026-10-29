# Memory safety

- Run Node commands with `NODE_OPTIONS=--max-old-space-size=4096` unless the user approves a higher limit.
- Before a long or data-heavy job, estimate memory use. Stream or sample data; do not load whole datasets into memory.
- Run long commands with a timeout and check their process-tree RSS every 2–3 seconds. Stop any process started for the task if it exceeds 4 GB, and tell the user.
- When a task ends, stop background processes started for it, including dev servers, watchers, workers, and persistent runtimes. Check for orphaned child processes.
- Avoid large temporary files and repeated rewrites. Tell the user before starting a job expected to write more than about 1 GB.
- Use `~/bin/memguard` for heavy commands. It must monitor only the process group it starts, default to a 4 GB RSS limit, accept a configurable limit, and stop that group if the limit is exceeded.
