# React Dashboard C3 Theme Research

## Objective and safety boundary

Bring the non-home React dashboards into the same calm, dark C3/Splunk UI visual language as the accepted home dashboard while preserving the home dashboard's layout, controls, and behavior. The current branch is `codex/general-fixes-enhancements`; the worktree was clean before implementation and `HEAD`/remote both resolved to `cb067a2ee6b104e7faf1710b080a717eda6aae3b`. That commit is the rollback baseline. No commit, tag, push, or Splunk restart is authorized by this task.

The home baseline was captured from `workspace_insights` before source changes:

- root canvas: `rgb(11, 17, 24)`
- primary panel: `rgb(26, 28, 32)`
- typography: Inter/system UI
- browser console: no errors in the captured state

## Entry-point architecture

All nine raw React entry points flow through the same renderer and theme provider:

```text
page render.tsx
  -> common/render-raw.tsx:mountPageRaw()
    -> common/theme/AppThemeProvider.tsx
      -> SplunkThemeProvider (Prisma, dark, comfortable, 1CD customizer)
      -> common/theme/SemanticThemeStyles.tsx
        -> page component
```

Entry points verified with `mountPageRaw`: `executive_insights`, `health_monitoring`, `m365_activity_monitoring`, `macro_index_tuning`, `network_diagram`, `searchbase_canvas`, `secure_operations_glass`, `topology_canvas_v1`, and `user_guide` (`pages/*/render.tsx`).

The accepted home dashboard is `pages/executive_insights`. It already uses shared workspace primitives and C3 page/surface styling. The other eight React pages already opt into the shared C3 atmosphere either with `scd-c3-atmosphere` or `C3_ATMOSPHERE_BACKGROUND_STYLE`:

- health: `HealthMonitoringDashboard.tsx:348`
- M365: `m365_activity_monitoring/index.tsx:349`
- macro tuning: `macro_index_tuning/index.tsx:2624,2849,3537`
- network diagram: `network_diagram/index.tsx:740`
- Searchbase: `searchbase_canvas/index.tsx:4943,5498`
- secure operations: `secure_operations_glass/index.tsx:2412`
- topology: `topology_canvas_v1/index.tsx:30`
- user guide: `user_guide/index.tsx:912`

This means a page-by-page redesign is unnecessary and risky. The highest-leverage correction is the shared semantic compatibility layer, followed by targeted migration of the places that use semantic color as a filled surface.

## Root causes

### 1. Semantic background classes use saturated status tokens as large surfaces

`common/theme/SemanticThemeStyles.tsx` currently maps:

```ts
.sui-bg-info     -> variables.statusColorInfoWeak
.sui-bg-positive -> variables.statusColorNormalWeak
.sui-bg-warning  -> variables.statusColorMediumWeak
.sui-bg-negative -> variables.statusColorCriticalWeak
```

In the active Prisma/1CD dark theme these `statusColor*Weak` values are still highly saturated. Browser evidence from Searchbase showed:

```text
sui-bg-negative + sui-color-negative: 1.24:1 contrast
sui-bg-info     + sui-color-info:     1.20:1 contrast
```

This is why HTTP 400 tiles become bright red with nearly unreadable red text. The same class pair appears across Searchbase, Health Monitoring, Topology, Network Diagram, M365, Macro Tuning, and User Guide.

Splunk UI already provides appropriate semantic surface tokens:

```text
notificationColorInfoWeak     dark #2E1B4B
notificationColorPositiveWeak dark #092635
notificationColorCautionWeak  dark #331E00
notificationColorNegativeWeak dark #391313
```

Native `Message appearance="fill"` also uses a calm popup-like surface with a semantic accent, rather than painting the entire region with a critical status color.

### 2. The custom-button reset is not actually low specificity

`common/styles/tailwind.css:281` uses a high-specificity root selector:

```css
:is(#scan-root, #configure-tile-drawer) :where(button...) {
  background: none;
  border: 0;
  color: inherit;
}
```

Because `:is()` retains the ID specificity, class-only semantic utilities cannot reliably restore the background, border, or text color. Live browser inspection confirmed that a raw `button.sui-bg-accent` can compute as transparent. The existing `workspaceVisuals.test.cjs` incorrectly describes this selector as low specificity and therefore locks in the bug.

The root selector itself must use `:where(...)` so the reset remains below component utilities. Native SUI buttons are already excluded with `data-test` selectors.

### 3. One class currently serves two incompatible roles

The current `sui-bg-info/positive/warning/negative` classes are used for both:

- large surfaces: callouts, error states, selected cards, badges, pills
- compact signals: 2-10 px dots, map markers, progress indicators

Large surfaces need notification-weak tokens. Compact signals need solid status tokens. A shared fix therefore needs explicit role classes rather than one ambiguous mapping.

### 4. `backgroundColorFloating` is used as a muted dark neutral

`sui-bg-floating` maps to `backgroundColorFloating`, which can be an inverted/white surface in the active dark theme. Several progress tracks, dividers, and unknown-status dots treat it as a subdued neutral. Those usages must move to explicit neutral or status roles instead of changing the token globally and risking SUI floating surfaces.

## Splunk UI guidance consulted

- `Message`: use inline messages for contextual feedback; use `appearance="fill"` for larger regions and keep semantic icons.
- `Button`: use native buttons for actions, `appearance="destructive"` for destructive actions, and preserve visible focus/keyboard behavior.
- Styling: use `@splunk/themes` variables rather than raw hex/RGB or ad-hoc CSS variables for product UI roles.

Searchbase already imports native SUI `Button`, so its broken error/no-data state is a low-risk canary for a native `Message` plus SUI actions.

## Scope and concerns

### In scope

- Shared semantic surface/status/neutral role classes based on SUI tokens.
- Correct the custom-button reset specificity and its regression test.
- Use Searchbase error/no-data panels as the canary for native SUI feedback/actions.
- Migrate same-tone semantic surfaces across the other non-home React dashboards.
- Preserve strong status dots/markers with explicit status classes.
- Add regression tests that prevent saturated same-tone surfaces from returning.
- Verify both Searchbase and the home dashboard after a no-restart install.

### Protected or out of scope

- Do not change `executive_insights` page behavior, section paging, tile counts, or home layout.
- Do not hide or reinterpret the underlying SPL/macro HTTP 400 error; only restore readable presentation.
- Do not change Dashboard Studio XML/theme behavior.
- Do not introduce Tailwind classes or hard-coded design colors.
- Do not restart Splunk.

### Rollback

Because the pre-change worktree was clean and the baseline commit is also on the remote branch, all new work can be inspected as an uncommitted diff and discarded or reverted intentionally if needed. No automatic reset/stash/checkout will be used. The safest checkpoint is source verification plus browser comparison before the user chooses whether to commit.
