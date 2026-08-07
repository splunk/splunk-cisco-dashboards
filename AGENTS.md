# Repository Workflow Guardrails

## Branch safety

- Codex must never create, edit, delete, stage, or commit repository files while the current branch is `main` or `master`.
- Before any task that may change repository files, Codex must run `git branch --show-current` and `git status --short`.
- Codex must create or switch to a task branch using the `codex/` prefix before making changes. Use `codex/general-fixes-enhancements` for miscellaneous bug fixes and enhancements when the user has not requested a more specific branch.
- Read-only inspection and diagnostics are allowed on `main` and `master`.
- Do not use Git worktrees unless the user explicitly requests one.
- Do not merge, push, or delete branches or tags without explicit user authorization.
- If uncommitted user changes make a branch switch unsafe, stop and ask the user. Never stash, reset, discard, or relocate those changes automatically.
