# Repository Workflow Guardrails

## Prefer Splunk UI over custom

Whereever and whenever possible use native Splunk UI Design system components and themeing. We are migrating off of tailwind so add no more tech debt by avoiding using anything of it and moving to Splunk UI (SUI) native solutions where possible. Consult the splunk-ui-mcp if you have it available for definitive information to that end.

## Branch safety

- Codex must never create, edit, delete, stage, or commit repository files while the current branch is `main` or `master`.
- Before any task that may change repository files, Codex must run `git branch --show-current` and `git status --short`.
- Codex must create or switch to a task branch using the `codex/` prefix before making changes. Use `codex/general-fixes-enhancements` for miscellaneous bug fixes and enhancements when the user has not requested a more specific branch.
- Read-only inspection and diagnostics are allowed on `main` and `master`.
- Do not use Git worktrees unless the user explicitly requests one.
- Do not merge, push, or delete branches or tags without explicit user authorization.
- If uncommitted user changes make a branch switch unsafe, stop and ask the user. Never stash, reset, discard, or relocate those changes automatically.

## Commit and checkpoint authorization

- Do not create commits unless the user explicitly asks for a commit in the current task.
- Do not create recovery or safety tags unless the user explicitly asks for a tag in the current task.
- A request to implement, fix, test, build, install, or verify work does not implicitly authorize a commit, tag, push, merge, or branch deletion.

## Unfinished-task continuity

- Treat implementation requests as requests to complete and verify the work, not as audit-only or recommendation-only work.
- If requested implementation cannot be completed, say so immediately and identify the exact blocker instead of silently substituting an audit or partial result.
- Before starting a materially different request in the same task, check whether important prior work remains unfinished, unverified, or awaiting a decision.
- If important work remains, pause and remind the user what is outstanding, then ask whether the new request replaces it or should wait. Do not allow a new request to silently abandon earlier work.
