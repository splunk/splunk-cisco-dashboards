# React Dashboard C3 Theme Implementation Plan

Approved direction: apply the accepted home dashboard's C3/Splunk UI design language to the other React dashboards, using shared foundations and protecting home behavior.

## Implementation checklist

- [DONE] Add explicit semantic role classes to `common/theme/SemanticThemeStyles.tsx`.
  - Notification surfaces use `notificationColorInfoWeak`, `notificationColorPositiveWeak`, `notificationColorCautionWeak`, and `notificationColorNegativeWeak`.
  - Compact status signals use the current SUI severity tokens: `severityColorInfo`, `severityColorNormal`, `severityColorWarning`, `severityColorCritical`, and `severityColorUnknown`.
  - Muted tracks/dividers use an appropriate neutral SUI background/border token.
  - Keep existing content, border, focus, atmosphere, and visualization roles unchanged.

  Intended pattern:

  ```ts
  .sui-bg-notification-negative {
      background-color: ${variables.notificationColorNegativeWeak};
  }
  .sui-bg-status-negative {
      background-color: ${variables.severityColorCritical};
  }
  ```

- [DONE] Fix the legacy custom-button reset in `common/styles/tailwind.css`.
  - Replace the `:is(#scan-root, #configure-tile-drawer)` reset root with `:where(...)` for buttons only.
  - Retain the SUI-component exclusions.
  - Update `test/workspaceVisuals.test.cjs` to reject an ID-specific reset.

- [DONE] Add shared theme regression coverage in `test/dashboardTheme.test.cjs`.
  - Require notification-weak tokens for surface roles.
  - Require solid status tokens for signal roles.
  - Prevent notification surfaces from being mapped to `statusColor*Weak`.

- [DONE] Convert Searchbase's broken feedback panels as the canary.
  - Use native `Message appearance="fill"` with `type="error"` or `type="info"` for the main no-data/error feedback.
  - Use native SUI `Button` actions for Open in Search, drilldown, Replace, and destructive Remove where touched.
  - Retain the existing content, handlers, and presentation-mode behavior.
  - Remove same-tone background/text class pairs from Searchbase badges and selected states, replacing them with explicit notification or status roles.

- [DONE] Migrate the remaining non-home React entry points and their shared components.
  - Filled panels/callouts/pills: `sui-bg-notification-*` plus readable content color.
  - Status dots/markers: `sui-bg-status-*`.
  - Progress tracks/dividers/unknown signals: explicit neutral roles.
  - Prioritize Health Monitoring, M365, Macro Tuning, Network Diagram, Secure Operations, Topology v1, and User Guide.
  - Do not edit `pages/executive_insights` behavior or layout.

- [DONE] Run incremental validation.
  - Targeted Node regression tests after shared theme/reset changes.
  - TypeScript typecheck after Searchbase and after remaining migrations.
  - Repository C3/theme/visual test suites.
  - Review diff for raw colors, Tailwind additions, and accidental home-page changes.

- [DONE] Run mandatory UI reviews.
  - Splunk UI code review on the changed React/TypeScript/CSS files; fix findings and rerun until clean.
  - Accessibility review of the web UI diff; fix actionable findings and rerun relevant tests.

- [DONE] Build, install, and verify without restarting Splunk.
  - Read and follow the repository build/install skill first.
  - Inspect commands/scripts for restart behavior; stop at the restart boundary if a restart cannot be ruled out.
  - Verify Searchbase at the reported error state: calm readable feedback, visible actions, no new console errors.
  - Verify home at `workspace_insights`: baseline canvas/panel styles, tile controls, section paging/expand behavior, and no new console errors.

## Test matrix

| Area | Source check | Runtime check |
|---|---|---|
| Shared theme | notification/status token assertions | computed foreground/background contrast |
| Raw buttons | low-specificity reset assertion | semantic/native button backgrounds visible |
| Searchbase | typecheck + focused tests | error/no-data panel and actions |
| Other React dashboards | C3/theme tests + typecheck | representative page smoke checks |
| Home protection | no functional diff under `executive_insights` | before/after metrics and interaction smoke |

## Rollback gates

1. Baseline is commit `cb067a2ee6b104e7faf1710b080a717eda6aae3b` on the current remote branch.
2. Keep changes uncommitted unless the user explicitly asks for a commit.
3. If targeted tests or typecheck fail, fix before build.
4. If home visual metrics or tile interactions regress, do not complete installation handoff; isolate/revert the shared change causing it.
5. Never reset, stash, discard, tag, commit, push, or restart Splunk without the required authorization.
