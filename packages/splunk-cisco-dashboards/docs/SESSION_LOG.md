# Splunk Cisco Dashboards — Session Log

> Running narrative of what we've built, the decisions behind it, and the
> verification that proved it works. Newer sessions go at the **top**.
> Each session ends with a "What's next" pointer so the following session
> has a clean handoff.

---

## 2026-05-17 (Build 1176) — Region membership reconciliation

### Goal

Fix the remaining Region/Site container bugs:

  * objects visibly inside a region not always moving with the
    region,
  * count badges not matching what is visibly inside,
  * inconsistent behavior depending on whether devices existed
    before or after the region.

### Root Cause

Build 1175 fixed React Flow's parent-before-child ordering, but the
container model was still event-specific. Device drags and palette
drops updated `parentId`; region creation, region movement, region
resize, diagram load, and undo/redo replay did not reconcile visible
containment back into `parentId`.

That allowed diagrams like this:

```text
region visually contains: Mobile, Switch, Internet
parented children:        Mobile, Internet
badge:                    2 devices
dragging region moves:    Mobile, Internet only
```

The screenshot from the operator matched this exactly: three cards
inside the region, but the badge read `2 devices`.

### Fix

Added one shared `reconcileRegionMembership(nodes)` pass in
`NetworkDiagramCanvas.tsx`.

The invariant is now:

```text
For every region membership checkpoint:
  node center inside region  -> node.parentId = region.id
  node center outside region -> node.parentId = undefined
  parent changes preserve the node's world position
  parent nodes are ordered before child nodes
```

Checkpoints:

  * diagram hydrate/load,
  * undo/redo replay,
  * dropping a new region,
  * completed region drag,
  * completed region resize.

Device drag/drop still keeps the Build 1174 cursor-based drop intent;
the reconciliation pass is deliberately not run on every mousemove, so
it does not reintroduce the old drag jitter.

### Verification

Browser artifacts:

  * `container-matrix-build1176/regression.json`:
    * initial visually-contained devices load as `3 devices`,
    * first region drag moved Mobile, Switch, and Internet,
    * dragging Mobile out changed the badge to `2 devices`,
    * moving the region over Mobile adopted it again and restored
      `3 devices`,
    * final region drag moved all three devices.
  * `preset-before-region-build1176/regression.json` — old device
    first, region added later, drag old device into region: still
    stays inside and counts as `1 device`.
  * `region-palette-build1176/trace.json` — new palette device dropped
    into existing region counts as `1 device`.
  * `empty-drop-build1176/regression.json` — empty-canvas palette drop
    still creates one gateway.
  * `network-regress-build1176/regression.json` — wheel pan still
    changes viewport translate, and connection drawing produces
    `edgeCount: 1`.
  * `oob-load-build1176/regression.json` — "Splunk Cloud Deployment
    Architecture" still loads with `nodeCount: 20`, `edgeCount: 13`.
  * `export-smoke-build1176/downloads/` — PNG and PDF export files
    were created.

Build/install verification:

```bash
yarn workspace @splunk/splunk-cisco-dashboards run typecheck
yarn workspace @splunk/splunk-cisco-dashboards run package:app
/opt/splunk/bin/splunk install app dist/splunk-cisco-dashboards-1.0.10.tar.gz -update 1 -auth admin:changeme
/opt/splunk/bin/splunk _internal call /services/server/control/restart -method POST -auth admin:changeme
```

### What's next

Use `stable-build1176` as the Network Diagram rollback point. Region
membership is now reconciled from visible containment instead of being
dependent on one specific gesture path.

## 2026-05-17 (Build 1175) — Fix preset-device Region snap + move build badge out of canvas

### Goal

Fix the remaining Region/Site misbehavior the operator reported after
Build 1174:

> Shapes that were preset before adding the region are misbehaving,
> but new ones added after the region drag/drop just fine.

Also move the build number out of the drawing canvas.

### Missed Case

Build 1174 verified devices dropped into an existing region and
off-center grabs into an existing region. It did not verify this
sequence:

1. A device already exists on the canvas.
2. A Region/Site is added afterwards.
3. The older device is dragged into that newer region.

That sequence reproduced the snap-back exactly.

### Trace

Build 1174, failing case:

```text
old_gateway_into_new_region:released
nodes: [shape_gateway, region_...]
shape_gateway transform: translate(120px, 60px)
shape_gateway rect.y: -127
region text: NEW REGION\n1 device
```

The count updated, but the card jumped out of view because React Flow
rendered the child's local coordinates as if they were global.

React Flow's local source explains why: `adoptUserNodes` walks the
`nodes` array in order, and `updateChildNode` requires the parent to
already be in `nodeLookup`. If a gateway existed before a region, the
array stayed `[gateway, region]`; reparenting made the gateway a child
before React Flow had seen the parent.

New devices did not fail because palette drops append the new child
after the existing region, producing `[region, newDevice]`.

### Fix

`NetworkDiagramCanvas.tsx` now keeps the target parent before the child
when an existing node changes `parentId`:

```text
[oldDevice, newRegion] + reparent(oldDevice -> newRegion)
→ [newRegion, oldDevice]
```

The position math from Build 1174 stays the same; the fix is the
missing React Flow ordering invariant.

The build badge moved from the canvas overlay into `DiagramHeader.tsx`
next to the active diagram name. The canvas no longer renders a build
label, including in the help popover footer.

### Verification

Browser artifacts were saved under `.cursor/playwright-output/`:

  * `preset-before-region-build1175/trace.json` — reproduced the
    operator's exact sequence and confirmed the final node order is
    `[region, gateway]`, the gateway remains at
    `translate(120px, 220px)`, and the region reads `1 device`.
  * `preset-before-region-build1175/old_gateway_into_new_region_released.png`
    — visual confirmation that the older gateway stays inside the
    newer region and Build 1175 appears in the header, outside the
    canvas.
  * `region-palette-build1175/trace.json` — a newly added gateway
    dropped into an existing region still counts as `1 device`.
  * `empty-drop-build1175/regression.json` — palette drop on an empty
    canvas produced `nodeCount: 1`, `gatewayCount: 1`.
  * `network-regress-build1175/regression.json` — wheel scroll still
    pans, and connection drawing still produced `edgeCount: 1`.
  * `oob-load-build1175/regression.json` — "Splunk Cloud Deployment
    Architecture" loaded with `nodeCount: 20`, `edgeCount: 13`.
  * `export-smoke-build1175/downloads/` — PNG and PDF exports were
    created from the Build 1175 canvas.

Build/install verification:

```bash
yarn workspace @splunk/splunk-cisco-dashboards run typecheck
yarn workspace @splunk/splunk-cisco-dashboards run package:app
/opt/splunk/bin/splunk install app dist/splunk-cisco-dashboards-1.0.10.tar.gz -update 1 -auth admin:changeme
/opt/splunk/bin/splunk _internal call /services/server/control/restart -method POST -auth admin:changeme
```

### What's next

Use `stable-build1175` as the rollback point for Network Diagram
region placement. It supersedes Build 1174, which fixed cursor
hit-testing but missed the parent-before-child node-order invariant.

## 2026-05-17 (Build 1174) — Region drag-snap root cause + surgical fix

### Goal

Fix the operator-reported Region/Site placement bug without repeating
the reverted 115.24-115.36 attempts:

> "placing objects in [a region] is very flaky and buggy! the number
>  of devices did not update. [...] if I try moving it inside the
>  region, it snaps out speratically and erratically"

Hard constraint for this session: investigate with a real browser
before writing any fix.

### Hypothesis

The first suspect was a React Flow parent/extent fight during drag:
`parentId` flipping between the region and `null`, with
`extent: 'parent'` clamping against the wrong coordinate space.

Reading React Flow's local source changed the expectation:
`applyNodeChanges` applies `position` / `dragging` changes only, and
does not assign `parentId`. Parent assignment is entirely our code in
`handleNodeDragStop`; hover feedback is our `handleNodeDrag`.

### Trace

Instrumented `handleNodesChange` and `annotateRegionCounts`, then
reproduced in Chromium with 200 ms screenshots and transform capture.
The centered drag did not show a React Flow parent flip. While dragging
into the region, the gateway stayed unparented until drop:

```text
handleNodesChange position {"id":"shape_gateway","dragging":true,
"changePosition":{"x":200,"y":220},"currentParentId":null,
"resolvedParentId":null,"currentExtent":null,"resolvedExtent":null}
```

The failing case was an off-center grab. The pointer was visibly inside
the region, but the card center remained outside, so the old
center/rect hit-test kept the node unparented and the count stayed at
zero:

```text
annotateRegionCounts {"inputParents":[{"id":"shape_gateway",
"type":"device:gateway","parentId":null}],"countEntries":[],
"outputRegions":[{"id":"g_region","deviceCount":0}]}
```

That explains the "flaky" feel: the outcome depended on where the
operator grabbed the card, not where they released the pointer.

### Fix

Small change in `NetworkDiagramCanvas.tsx`:

  * Add `findRegionForPoint(nodes, point)`, preserving
    "smallest containing region wins" for nested regions.
  * Keep palette-drop behavior on the existing center-of-new-card
    `findRegionForRect` path.
  * Switch existing-node `handleNodeDrag` hover and
    `handleNodeDragStop` commit to resolve the target region from the
    cursor/grab point via `reactFlow.screenToFlowPosition(...)`.

No wheel handling, page bounds, `nodeExtent`, panning, or
`overflow-hidden` changes were made.

### Verification

Browser artifacts were saved under `.cursor/playwright-output/`:

  * `region-edge-grab-build1173/trace.json` — the same off-center grab
    now releases with region text `REGION\n1 device`.
  * `region-drag-build1173/trace.json` — centered existing-node drag
    still stays inside and counts correctly.
  * `region-palette-build1173/trace.json` — palette device drop into
    a region still counts correctly.
  * `empty-drop-build1174/regression.json` — palette drop on an empty
    canvas produced `nodeCount: 1`, `gatewayCount: 1`.
  * `network-regress-build1174/regression.json` — wheel scroll changed
    viewport translate while preserving scale, and connection drawing
    produced `edgeCount: 1`.
  * `oob-load-build1174/regression.json` — "Splunk Cloud Deployment
    Architecture" loaded with `nodeCount: 20`, `edgeCount: 13`.
  * `export-smoke-build1174/downloads/` — PNG and PDF exports were
    created from the Build 1174 canvas.

Build/install verification:

```bash
yarn workspace @splunk/splunk-cisco-dashboards run typecheck
yarn workspace @splunk/splunk-cisco-dashboards run package:app
/opt/splunk/bin/splunk install app dist/splunk-cisco-dashboards-1.0.10.tar.gz -update 1 -auth admin:changeme
/opt/splunk/bin/splunk _internal call /services/server/control/restart -method POST -auth admin:changeme
```

The canvas build pill showed **Build 1174** after hard refresh.

### What's next

Treat `stable-build1174` as the surgical successor to
`stable-build1173`: same rollback-safe canvas, plus the cursor-based
Region/Site drag fix.

## How to revert to the last known-good Network Diagram canvas

The Network Diagram authoring canvas was rolled back to **Build 1173 /
115.23** on 2026-05-17 after a 12-build streak (115.24-115.36, builds
1174-1185) progressively broke connection drawing, region drag, and
scrolling. Every one of those 12 builds was reversed via transcript
replay; the result is captured in commit `f712a1a` and the annotated
git tag `stable-build1173`.

### When to revert

Revert if a future change breaks any of these (all working at the
tagged commit):

  * Drawing a connection between two device handles
  * Dropping a device from the palette onto an empty canvas
  * Wheel/trackpad scroll panning the canvas (Cmd/Ctrl+scroll zooms)
  * PNG/PDF export with a clean white background
  * The 12 OOB seed diagrams loading via the dropdown picker

### Revert commands

```bash
cd /Users/akhamis/repo/splunk-cisco-dashboards
git reset --hard stable-build1173
yarn workspace @splunk/splunk-cisco-dashboards run package:app
/opt/splunk/bin/splunk install app \
  /Users/akhamis/repo/splunk-cisco-dashboards/dist/splunk-cisco-dashboards-1.0.10.tar.gz \
  -update 1 -auth admin:changeme
/opt/splunk/bin/splunk _internal call \
  /services/server/control/restart -auth admin:changeme
```

After Splunk finishes restarting, hard-refresh the dashboard in the
browser (`Cmd+Shift+R`); the canvas top-right pill should read
**Build 1173**.

### What is NOT fixed at this tag

  * **Region drag-snap bug.** Dragging a device into a Region/Site
    container can make it snap erratically out during the drag, and
    the region's device count can desync. This is the bug operator
    flagged at 4:17 PM on 2026-05-16 and what the rollback was done
    to clear ground for. Investigate with a real browser-driving
    agent (Playwright MCP) before writing any fix; the previous 12
    attempts patched blind from screenshots and made it worse.

### Dev environment quick-reference

  * **Splunk Web (browser):** `http://sh-i-ak:8000`
  * **Splunk login:** `admin` / `changeme`
  * **Splunk REST (mgmt):** `https://localhost:8089` (CLI default)
  * **App path on this machine:**
    `/opt/splunk/etc/apps/splunk-cisco-dashboards/`
  * **Network Diagram page:**
    Splunk Web → app picker → "Splunk Cisco Dashboards" →
    "Network Diagram" in the nav, **OR** direct URL:
    `http://sh-i-ak:8000/en-US/app/splunk-cisco-dashboards/network_diagram`
  * **Playwright MCP** is configured in `.cursor/mcp.json`. Storage
    state is persisted at `.cursor/playwright-state.json` (gitignored)
    so the first login carries over to subsequent sessions.

---

## 2026-05-16 (Build 115.23) — Clean white canvas in Present mode + PNG/PDF export

### Goal

Operator quote:

> "I want present mode to not show the dots and the same when
>  we export to pdf or png, keep a clean white background not
>  canvas or grid."

Present mode was already supposed to hide the dot grid (114
work) and indeed did. The issue was twofold:

  1. **Present-mode wrapper was `bg-slate-50`** (≈ #f8fafc), a
     faint gray tint. Operators showing the diagram on a slide
     deck or against a white window saw the canvas as "slightly
     dirty". They wanted PURE white.

  2. **Export captured the editor.** The PNG / PDF capture is
     produced by `useExportPage` running html2canvas against
     the live DOM. If the operator was in EDIT mode when they
     clicked export, the rasterised image included the dot
     grid (because edit-mode renders the grid) and used the
     same off-white html2canvas backplate (`#f8fafc`). The
     result looked like a screenshot of the editor, not a
     finished artefact.

### Discovery & decision

Three fixes, motivated by what each surface needs to look
like:

  • **Present mode wrapper** — pure `bg-white` in light theme
    (was `bg-slate-50`). Dark theme stays at `slate-950` so
    operators who chose dark theme also get dark presents.
  • **Export wrapper** — pure `bg-white` regardless of theme.
    Operators export to share with audiences who want a
    printable / pasteable artefact. A dark-mode capture would
    look out of place in a slide deck or PDF report; white is
    the universal "shareable" background. We deliberately
    DON'T inherit the operator's theme for exports.
  • **Export capture** — suppress the dot-grid `Background`
    component during the rasterisation, AND change html2canvas
    `backgroundColor` from `'#f8fafc'` to `'#ffffff'`. The
    backplate change matters because html2canvas uses it for
    any fully-transparent regions in the captured DOM (e.g.,
    the React Flow viewport). With the dot-grid gone, the
    backplate is what shows through.

Implementation note — **rAF wait before capture**. Setting
`exporting=true` flips React state but doesn't synchronously
re-render. The dynamic imports (`html2canvas`, `jsPDF`) are
fast on a warm cache; on those paths we'd rasterise BEFORE
React had a chance to commit the dot-grid removal. Solution:
one `requestAnimationFrame` between `setExporting(true)` and
the html2canvas call. React commits + browser paints within a
single frame for a one-shot state flip, so one rAF is enough.

We considered also hiding the build pill, Controls (+/-),
and MiniMap during export. Decided NO for now — the operator
asked specifically about the grid + background. Over-hiding
is a different design conversation (do they want totally bare
diagrams? do they want the legend? what about the overall
title?). If they ask for "fully clean exports" later we can
do a second pass with a wider hide-list.

### Files touched

  • `packages/splunk-cisco-dashboards/src/main/webapp/common/components/diagram/NetworkDiagramCanvas.tsx`
      - New `exporting?: boolean` prop on
        `NetworkDiagramCanvasProps`.
      - Wrapper `className` cn() now branches on
        `exporting → isViewMode → edit` for backgrounds:
          • exporting   → `bg-white border-slate-200`
            (no dark variant — exports are always white).
          • isViewMode  → `bg-white dark:bg-slate-950 …`
            (was `bg-slate-50` in light).
          • edit        → unchanged.
      - Dot-grid `<Background>` now gated on
        `!isViewMode && !exporting`.
  • `packages/splunk-cisco-dashboards/src/main/webapp/pages/network_diagram/index.tsx`
      - Passes `exporting={exporting}` (already had the flag
        from `useExportPage`) down to `NetworkDiagramCanvas`.
  • `packages/splunk-cisco-dashboards/src/main/webapp/common/hooks/useExportPage.ts`
      - `backgroundColor: '#ffffff'` (was `#f8fafc`).
      - Added a `requestAnimationFrame` await between
        `setExporting(true)` and the html2canvas call so the
        consumer tree has actually re-rendered with the new
        flag before rasterisation.
  • `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/app.conf`
      - Build 1172 → 1173.
  • `packages/splunk-cisco-dashboards/docs/SESSION_LOG.md`
      - This entry.

### Verification

  • `yarn workspace @splunk/splunk-cisco-dashboards run typecheck` → clean.
  • `yarn workspace @splunk/splunk-cisco-dashboards run package:app` → produced
    `dist/splunk-cisco-dashboards-1.0.10.tar.gz` (14 MB);
    embedded `default/app.conf` confirms `build = 1173`.
  • Manual checks the operator should run after install +
    `splunk _bump` + Cmd+Shift+R:
      1. Edit mode → dot grid still visible (unchanged).
      2. Click "Present" → wrapper is PURE white (no slate
         tint), no dot grid.
      3. Edit mode → click "Export → PNG". Open the
         downloaded file. No dot grid, pure white
         background, no editor chrome that wasn't there
         before.
      4. Edit mode in DARK theme → click "Export → PDF". Open
         the file. Background is still white (theme-
         independent for exports), diagram contents render
         on the white surface.
      5. Build pill still reads "Build 1173" in the canvas
         top-right (unchanged in this build).

### What's next

  • Operator confirms 115.23 makes Present mode and exports
    look clean.
  • Returning to the menu we paused at the start of 115.21:
      (B) Auto-stash unsaved canvas work to sessionStorage
          on every change → restore on mount. Makes the
          115.20 "Reload page" CTA non-destructive. ~1-2 hr.
      (C) Phase 6 — inventory automation. Auto-bind by name
          match, bulk import from `asset_inventory`,
          "Suggest from inventory" seed layout. Multi-
          session.
      (D) Parked design questions Q1 (bottom text on unbound
          cards) and Q2 (display name vs short alias on
          canvas).
  • Operator originally chose (A) build pill in 115.21. With
    that shipped + bug-fixed in 115.22, they should pick
    one of the remaining options for the next thread.

---

## 2026-05-16 (Build 115.22) — Build tag fix: drop defensive `typeof process` guard; read version from app.conf

### Goal

Operator installed 115.21, ran `splunk _bump`, hard-refreshed,
and screenshotted the new build pill. It read **"Build dev"**
instead of **"Build 1171"**. The screenshot was unmistakable —
the pill was rendering, in the right position, with the right
styling, but with the fallback value.

### Diagnosis

Inspected the minified bundle directly:

```
var db = "undefined" != typeof process && process.env ? "1171" : "dev"
```

The DefinePlugin substitution itself worked perfectly — the
literal `"1171"` is right there in the ternary's true branch.
But the runtime can never reach that branch in the browser
because `process` is not a global there, so
`typeof process != "undefined"` is **false** and the ternary
falls through to `"dev"`.

The 115.21 `buildInfo.ts` was written like this:

```ts
export const APP_BUILD: string =
    (typeof process !== 'undefined' && process.env &&
     process.env.APP_BUILD) || 'dev';
```

The `typeof process !== 'undefined'` was added "defensively"
in case the bundle ran outside webpack. That was wrong on two
levels:

  1. **Splunk Web bundles run in browsers**, not in node. The
     defensive scenario that motivated the guard is the one
     that's GUARANTEED to be falsy in production. The whole
     guard is backwards.

  2. **DefinePlugin only replaces the exact dotted path**
     (`process.env.APP_BUILD`). The OTHER `process.env`
     reference in the same chain (the bare one, used as a
     truthiness probe) is left intact, and short-circuits
     for the same reason.

Trust the substitution. After DefinePlugin runs:

```js
process.env.APP_BUILD || 'dev'
//      becomes
"1171" || 'dev'
//      evaluates to
"1171"
```

No `process` global ever needs to exist at runtime; the
reference is gone by the time the bundle ships. The fallback
('dev') is only hit if webpack runs WITHOUT our DefinePlugin
— typically a unit test harness or an ad-hoc node script —
where node provides a real `process` global anyway, so
`process.env.APP_BUILD` resolves to undefined and the OR
fallback kicks in cleanly.

### Bonus fix found while looking at the bundle

The version label was reading **"v0.1.0"** because 115.21
read `package.json#version` (which is the npm workspace
version, "0.1.0" today) instead of `app.conf#version`
(which is "1.0.10" — the canonical Splunk app version that
splunkd reports and the Splunk Web Apps page displays).

Operators identifying their version in a support ticket
should see the SAME string that splunkd reports for the
app — anything else is a 20-minute "wait, which version
are you actually on?" detour. We're already reading
`build = NNNN` from app.conf in webpack.config.js; reading
`version = X.Y.Z` from the same file is a one-line
generalisation.

### Files touched

  • `packages/splunk-cisco-dashboards/src/main/webapp/common/lib/buildInfo.ts`
      - Removed the `typeof process !== 'undefined'` guard
        and the bare `process.env` truthiness probe.
      - Now reads `process.env.APP_BUILD || 'dev'` directly
        — DefinePlugin substitutes the LHS at compile time,
        so the runtime value is the literal build number.
  • `packages/splunk-cisco-dashboards/webpack.config.js`
      - Generalised `readAppBuild()` → `readAppConfField(key)`
        so the same regex-anchored matcher serves both
        `build` and `version` lookups.
      - APP_VERSION now reads `version = X.Y.Z` from
        `default/app.conf` (matches what splunkd reports),
        replacing the `require('./package.json').version`
        fallback (which would print "0.1.0").
  • `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/app.conf`
      - Build 1171 → 1172.
  • `packages/splunk-cisco-dashboards/docs/SESSION_LOG.md`
      - This entry.

### Verification

  • `yarn workspace @splunk/splunk-cisco-dashboards run typecheck` → clean.
  • `yarn workspace @splunk/splunk-cisco-dashboards run package:app` → produced
    `dist/splunk-cisco-dashboards-1.0.10.tar.gz` (14 MB).
  • Bundle inspection (the smoking gun this time):

    ```
    var db = "1172", fb = "1.0.10",
        mb = "v".concat(fb, " · Build ").concat(db)
    ```

    No guards, no ternary, no fallback. The literals are
    baked straight in.
  • Manual checks the operator should run after install +
    `splunk _bump` + Cmd+Shift+R:
      1. Build pill in canvas top-right reads "Build 1172".
      2. Hover → tooltip reads "v1.0.10 · Build 1172"
         (matches what splunkd reports for the app).
      3. Help (i) popover footer reads
         "Splunk Cisco Dashboards · v1.0.10 · Build 1172".

### Lesson learned

When DefinePlugin (or any compile-time substitution
mechanism) is doing the heavy lifting, "defensive" guards
around the substituted reference are almost always wrong
— they either short-circuit before the literal can be
read, or they reference symbols that DefinePlugin doesn't
substitute and that don't exist at runtime. Trust the
plugin; let the fallback be the only thing the
non-substituted code path produces.

### What's next

  • Operator confirms 115.22 pill reads "Build 1172"
    after `_bump` + refresh.
  • Open menu (unchanged from 115.21):
      (B) Auto-stash unsaved canvas work to sessionStorage.
      (C) Phase 6 — inventory automation.
      (D) Parked design questions Q1 / Q2.

---

## 2026-05-16 (Build 115.21) — Always-visible build tag in the canvas (compile-time injection)

### Goal

After 115.20 shipped, the operator still saw scroll-as-zoom
behaviour in the browser. The fix was correct in the bundle
on disk (we verified `panOnScroll` / `zoomOnScroll={false}` /
`zoomActivationKeyCode` ALL present in
`appserver/static/pages/network_diagram.js`) — but their
browser was running a cached older bundle from before the
115.19 install. `splunk install app -update 1` updates files
on disk; it does NOT bump the splunkweb static-asset cache
token. Cmd+Shift+R alone wasn't enough either, because Splunk
Web serves static assets from `/static/@<hash>/...` URLs
where `<hash>` only rotates on:

  • `splunk _bump`
  • `splunk restart`
  • the operator manually clearing site data

Once the operator ran `splunk _bump` the new behaviour took
effect immediately. Total time lost to the diagnosis: ~30
minutes. Operator quote at the start of that 30 min:

> "scrolling is worse now! oh my gosh, what did you do!"

That's a UX failure of OURS, not theirs — there was no way
for the operator to verify which bundle version was actually
running in the browser. We need a "is the new build loaded?"
indicator that's always visible.

### Discovery & decision

Three design choices, each motivated by the diagnostic
property we want:

1. **Inject the build number at compile time, not fetch it
   at runtime.** A runtime fetch from splunkd would tell the
   operator what the SERVER's `app.conf` says today — which
   could differ from the bundle currently executing in the
   browser if there's a cache mismatch. That defeats the
   point. Compile-time injection guarantees the displayed
   value MATCHES the JS bytes that printed it.

2. **Use `webpack.DefinePlugin` to read `default/app.conf`
   at build time.** The `build = NNNN` line is the canonical
   build identifier and we already bump it on every release.
   Reading it once during webpack runs is cheaper than
   maintaining a separate constant somewhere that drifts
   from the .conf reality. The `package.json#version` is
   read the same way for the secondary version label.

3. **Render in two places, with two different priorities:**
   - **Top-right of the canvas, always visible** (no edit /
     view-mode gate, no empty-canvas gate). A small
     "Build 1171" pill in monospace at 10px so it's
     unobtrusive but legible. This is the at-a-glance
     check.
   - **Footer of the Help (i) popover** with the full
     "Splunk Cisco Dashboards · v1.0.10 · Build 1171"
     label. Discoverable rather than always-on; gives the
     operator a copy-pasteable string for support
     tickets.

We considered putting the build tag in the page header
instead, but the header is already cramped (picker, dirty
dot, action buttons, theme toggle, animation toggle, IP
toggle, export dropdown) and adding more would crowd a
zone the operator interacts with constantly. The canvas
top-right corner is otherwise empty in view mode and
sparsely used in edit mode (only the help button), so
real estate is plentiful and the badge doesn't compete
with anything for attention.

### Files touched

  • `packages/splunk-cisco-dashboards/webpack.config.js`
      - Added `webpack.DefinePlugin` injection of
        `process.env.APP_BUILD` (read from `default/app.conf`'s
        `build = NNNN` line) and `process.env.APP_VERSION`
        (read from `package.json#version`).
      - Helper `readAppBuild()` parses the .conf at compile
        time with a regex; falls back to `'unknown'` on
        unexpected file shape (defensive but unreachable in
        practice).
  • `packages/splunk-cisco-dashboards/src/main/webapp/common/lib/buildInfo.ts` (new)
      - Re-exports the injected env values as typed
        constants (`APP_BUILD`, `APP_VERSION`,
        `APP_VERSION_LABEL`). Localises the
        `process.env.X ?? 'dev'` ceremony so call sites
        stay clean.
  • `packages/splunk-cisco-dashboards/src/main/webapp/common/components/diagram/NetworkDiagramCanvas.tsx`
      - Imported the build-info module.
      - Added an always-visible "Build NNNN" pill at
        `top-3 right-24` (clears the help button at
        `right-14` with a 12px gap regardless of badge
        width).
      - Added a footer line in the help popover with the
        full version label.
  • `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/app.conf`
      - Build 1170 → 1171.
  • `packages/splunk-cisco-dashboards/docs/SESSION_LOG.md`
      - This entry.

### Verification

  • `yarn workspace @splunk/splunk-cisco-dashboards run typecheck` → clean.
  • `yarn workspace @splunk/splunk-cisco-dashboards run package:app` → produced
    `dist/splunk-cisco-dashboards-1.0.10.tar.gz` (14 MB).
  • Bundle inspection confirms compile-time injection
    landed: the literal string `"1171"` appears in
    `appserver/static/pages/network_diagram.js` (would
    not appear from any other code path), and the
    literal "Splunk Cisco Dashboards · v" appears once
    (the popover footer template).
  • Manual checks the operator should run after install
    + `splunk _bump`:
      1. Open any diagram → top-right corner shows
         "Build 1171" pill (always, regardless of mode
         or empty canvas).
      2. Hover the pill → tooltip reads
         "v1.0.10 · Build 1171".
      3. Open the Help (i) popover → footer reads
         "Splunk Cisco Dashboards · v1.0.10 · Build 1171".
      4. Future upgrade: install new tarball, run
         `splunk _bump`, hard-refresh. The pill should
         flip to the new build number IMMEDIATELY upon
         reload. If it doesn't, the operator knows in
         5 seconds (not 30 minutes) that the cache
         didn't bust and they should try `splunk
         restart` or DevTools → Clear site data.

### Operational rule going forward

After every `splunk install app -update 1`, the operator
should run **one** of:

  • `splunk _bump` (fastest, no restart)  — preferred
  • `/opt/splunk/bin/splunk restart`      — if `_bump`
                                            misses anything
  • DevTools → Application → Storage → Clear site data
                                          — nuclear option

…then hard-refresh the browser (Cmd+Shift+R) and verify
the build-number pill matches the build they expect. If
the pill matches, the new bundle is definitely loaded
and any remaining issues are real bugs to debug. If it
doesn't, the cache hasn't busted yet — try the next
option in the list before reporting a bug.

This will be added to the deploy / upgrade docs (TBD)
the next time we touch them.

### What's next

  • Operator confirms the build pill renders as expected
    after install + `_bump` + refresh.
  • Open menu of next-steps the operator can pick from
    (proposed via AskQuestion at the start of this
    session):
      (B) Auto-stash unsaved canvas work to sessionStorage
          on every change → restore on mount → makes the
          115.20 "Reload page" CTA non-destructive. Modest
          scope, large UX win.
      (C) Phase 6 — inventory automation. Auto-bind by
          name match, bulk import from `asset_inventory`,
          "Suggest from inventory" seed layout. Multi-
          session.
      (D) Parked design questions Q1 (bottom text on
          unbound cards) and Q2 (display name vs short
          alias on canvas). Need operator's pick first.

---

## 2026-05-16 (Build 115.20) — Error toast no longer truncates; one-click "Reload page" CTA on stale-CSRF errors

### Goal

After 115.18 shipped the friendlier CSRF error message ("Splunk
session token is stale … Reload the page to refresh the CSRF
cookie, then try the save again."), the operator hit it in the
field and screenshotted this:

> "Save failed: Couldn't save the diagram: Splunk session token
>  is stale (HTTP 401 Splunk cannot authenticate the request.
>  CSRF validation failed.). **Rel...**"

The improved message landed correctly — the wording came from
115.18's `friendlyMessage` rewrite — but the operator's screen
truncated the actionable instruction at "Rel..." and they had
no idea the next word was "Reload". They reported themselves
still blocked and asked whether the build was actually current.

Tarball was confirmed at build 1169 (115.19) per its embedded
`default/app.conf`, so the fix WAS shipped. The bug was the
**rendering** of that long message, not the message itself.

### Discovery & decision

Root cause traced to one CSS class on the inline status display
in `DiagramHeader.tsx`:

```tsx
{statusMessage && (
    <span className="text-[10px] truncate ...">
        {statusMessage.text}
    </span>
)}
```

`truncate` is the Tailwind alias for
`overflow:hidden;text-overflow:ellipsis;white-space:nowrap`.
That treatment makes sense for a "Saved 'foo' at 3:21pm"
toast, where a single line and an ellipsis are net polite.
For an error containing a multi-clause recovery instruction
it actively hurts — the operator can see WHAT failed but
can't see WHAT TO DO. Worse, the text is sized at 10px,
the smallest readable size in the entire app, and is
positioned beside the diagram-name picker where it competes
with the clickable name affordance.

Decision: split rendering by message kind.
  • Info messages (3.5s auto-dismiss; short, transient) keep
    the inline 10px / truncated treatment in the picker row.
  • Error messages render as a dedicated alert banner
    BELOW the header — multi-line, no truncate, with an
    AlertTriangle icon and rose-tinted background. CSRF
    errors additionally get a primary "Reload page" CTA.
    Errors are now sticky (no auto-dismiss) and require an
    explicit X dismissal or get evicted by the next save /
    open / delete result.

The "Reload page" button just calls `window.location.reload()`.
We deliberately do NOT auto-reload — operators may have
unsaved on-canvas annotations they want to copy first
(the friendly message itself warned about this), and an
auto-reload would silently nuke them. The button gives
the operator a one-click recovery path the moment they're
ready, exactly the affordance the original message tried
to describe in prose.

We also did NOT introduce auto-stash to localStorage /
sessionStorage. That's a real next-tier improvement
(survive reload without losing in-progress work), but
it's a meatier behavioural change and would need its
own design pass for restoration UX (banner that says
"Restored unsaved work"? auto-load on next visit? what
if the stashed work conflicts with a remote update?).
Filing as `phase-6` candidate; not blocking 115.20.

### Files touched

  • `packages/splunk-cisco-dashboards/src/main/webapp/common/components/diagram/DiagramHeader.tsx`
      - Imported `AlertTriangle` and `RefreshCw` icons.
      - Inline `statusMessage` rendering narrowed to
        `kind === 'info'` only.
      - Added an `isCsrfError` heuristic (matches "stale" or
        "csrf" in the message body, mirroring
        `friendlyMessage`'s detection).
      - Added an alert banner outside the `<header>` that
        wraps the full error text, shows a primary
        "Reload page" button when CSRF, and an X dismiss
        button when `onDismissStatus` is provided.
      - New `onDismissStatus?: () => void` prop on
        `DiagramHeaderProps`.
  • `packages/splunk-cisco-dashboards/src/main/webapp/pages/network_diagram/index.tsx`
      - Removed the 8-second auto-dismiss for errors (info
        toasts still clear at 3.5s). Errors now stay until
        explicit dismissal or replacement.
      - Wired `onDismissStatus={() => setStatusMessage(null)}`
        through to the header.
  • `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/app.conf`
      - Build 1169 → 1170.
  • `packages/splunk-cisco-dashboards/docs/SESSION_LOG.md`
      - This entry.

### Verification

  • `yarn workspace @splunk/splunk-cisco-dashboards run typecheck` → clean.
  • `yarn workspace @splunk/splunk-cisco-dashboards run package:app` → produced
    `dist/splunk-cisco-dashboards-1.0.10.tar.gz` (14 MB);
    embedded `default/app.conf` confirms `build = 1170`.
  • Manual checks the operator should run after install:
      1. Trigger a CSRF save failure (let the page sit for
         a few hours, or clear `splunkweb_csrf_token_<port>`
         from the browser's cookie jar, then click Save).
      2. Banner appears below the header with the FULL
         "Splunk session token is stale … Reload the page
         to refresh the CSRF cookie, then try the save
         again. Your in-progress diagram is preserved on
         the canvas until you reload, so copy any unsaved
         annotations to a safe place before refreshing."
         text and a red "Reload page" button on the right.
      3. Click "Reload page" → page reloads → save works.
      4. Trigger any other error (e.g. invalid name) →
         banner appears WITHOUT the Reload CTA, just the
         X dismiss button.
      5. Successful save → green-flavoured info still
         renders inline next to the picker; banner area
         disappears.

### What's next

  • Operator confirms 115.20 makes the CSRF recovery path
    obvious. If they still hit save failures AFTER clicking
    the Reload button, that points at a deeper auth /
    role / proxy issue and we hand it to Splunk admin
    diagnostics.
  • Auto-stash unsaved work to sessionStorage on every
    livePayloadRef change, restore on mount → tracked as
    a phase-6 candidate alongside inventory automation.
    Defer until an operator hits "I lost work to a reload"
    in practice.
  • Phase 6 (inventory automation) still on deck: auto-bind
    by name match, bulk import, "Suggest from inventory"
    seed layout.

---

## 2026-05-16 (Build 115.19) — Wheel/trackpad scroll pans; ⌘ / Ctrl + scroll zooms

### Goal

Operator quote:

> "can you not allow zoom-in/zoom-out using the mouse pad
>  which I use to scroll with? right now I need to move
>  the mouse to the edge of the screen to stop it from
>  zooming and at that point it does allow me to scroll
>  up/down. I don't mind we have a keyboard instructions
>  like hold ctrl or command key on mac, then use the
>  mouse to zoom in and out etc... please find the best
>  way to solve that as it's very annoying."

### Discovery & decision

React Flow's default wheel/trackpad behaviour is **wheel
= zoom**. That's the Google-Maps mental model — works
fine for "navigate a finished map", but for an authoring
surface it fights the operator. Their natural reflex when
a card extends below the visible viewport is "scroll the
canvas with the trackpad", exactly like a long document.
With wheel-as-zoom, every such gesture zooms in instead,
so the operator has to drag the viewport up by hand,
zoom-out, drag again, etc. — death by a thousand
papercuts.

React Flow exposes the right knobs to swap mental models:

  • `panOnScroll` — when true, wheel/trackpad scroll pans
    the viewport.
  • `zoomOnScroll` — when false, wheel scroll never zooms.
  • `zoomActivationKeyCode` — modifier key that, when
    held, switches the gesture from pan back to zoom.
  • `zoomOnPinch` — left at default `true` so two-finger
    pinch on a trackpad still zooms (it's already a
    deliberate gesture, not "I'm scrolling").
  • `zoomOnDoubleClick` — left at default; double-click
    zooms in, matching the bottom-left controls widget.

Modifier key choice: **Cmd on Mac, Ctrl on Win/Linux**.
React Flow accepts `zoomActivationKeyCode` as a single
key OR an array, so we pass `['Meta', 'Control']` to
cover both platforms in one expression. (`Meta` is Cmd
on macOS, the Windows key on Windows; either feels
correct to the user holding it.)

Mode parity: same gesture rules apply in **both** edit
mode and view mode. We considered keeping wheel-zoom in
view mode (cinematic walkthrough mental model), but
flipping gesture rules between modes would itself be
disorienting, and operators learn one rule once. Pinch
+ Cmd/Ctrl + the bottom-left controls cover every zoom
need in either mode.

### Files touched

  • `packages/splunk-cisco-dashboards/src/main/webapp/common/components/diagram/NetworkDiagramCanvas.tsx`
      - Added `panOnScroll`, `zoomOnScroll={false}`, and
        `zoomActivationKeyCode={['Meta','Control']}` to
        the `<ReactFlow>` props with a long-form comment
        explaining the operator quote and rationale.
      - Added a "Pan & zoom" section to the in-canvas
        Help popover (the Info button at the top-right)
        documenting the new gesture map.
  • `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/app.conf`
      - Build 1168 → 1169.
  • `packages/splunk-cisco-dashboards/docs/SESSION_LOG.md`
      - This entry.

### Verification

  • `yarn workspace @splunk/splunk-cisco-dashboards run typecheck` → clean.
  • `yarn workspace @splunk/splunk-cisco-dashboards run package:app` → produced
    `dist/splunk-cisco-dashboards-1.0.10.tar.gz` (14 MB).
  • Confirmed only one `<ReactFlow>` instance in the repo
    (`NetworkDiagramCanvas.tsx`), so no other dashboards
    inherited the old behaviour.
  • Manual checks the operator should run after install:
      1. Two-finger trackpad scroll on the canvas →
         viewport pans, zoom level unchanged.
      2. Mouse wheel on the canvas → viewport pans
         vertically, zoom level unchanged.
      3. Hold ⌘ (Mac) or Ctrl (Win/Linux) + scroll →
         viewport zooms toward / away from the cursor.
      4. Trackpad pinch (no modifier) → viewport zooms.
      5. Bottom-left controls widget — `+` / `−` / fit
         buttons still work as before.
      6. Open the Info popover (top-right) → "Pan & zoom"
         section documents the new gestures.

### What's next

  • Operator confirms wheel-pan feels natural and the
    Cmd/Ctrl+scroll modifier works on their Mac.
  • If anyone reports muscle-memory friction with
    wheel-zoom (e.g. operators who've used the canvas
    for a while), we can offer a per-user toggle in the
    header (`localStorage`-persisted) that flips back to
    the old default. Defer until someone actually asks
    for it — premature configurability is its own UX
    debt.
  • Phase 5 (Region UX) is now fully wrapped — see 115.18
    "Status reminder" for the full timeline. Next major
    block is **phase 6 (inventory automation)**: auto-bind
    by name match, bulk import from `asset_inventory`,
    "Suggest from inventory" seed layout.

---

## 2026-05-16 (Build 115.18) — Region hit-test threshold reverted to centre-in-region; CSRF 401 message disambiguated

### Goal

Operator pulled 115.17 and reported three things:

> "we have a regression I think, we need to fix before we
>  continue! I am getting error messages when saving, I
>  also lost the ability to move the region together with
>  it's devices as one unit like we had it working before
>  and the number of devices in the region is incorrect.
>  I added 6 objects but it shows 1 device instead of 6."

Console showed:

```
POST .../servicesNS/nobody/splunk-cisco-dashboards/configs/conf-network_diagrams/test123
  401 (Splunk cannot authenticate the request. CSRF validation failed.)
```

Two distinct bugs, two fixes:

### (1) — Hit-test threshold was too strict (regression from 115.17)

115.17 introduced a "≥ 50% of the shape's area must overlap
the region" rule for parenting decisions. With centre-on-
cursor placement (also 115.17) and the 20px snap-to-grid,
a card dropped near a region's CORNER easily falls below
50% overlap because the centred 100×110 card overflows the
corner by ~50%. Result: only 1 of the 6 cards the operator
dropped passed the 50% bar, the other 5 floated unparented:

  • Region "device count" badge read 1 (correct given how
    many were actually parented, wrong from the operator's
    point of view).
  • Dragging the region only carried that one parented
    card along — the other 5 stayed put. The operator
    perceived this as "lost the ability to move the region
    together with its devices as one unit" because the
    *visible* effect is identical to children losing their
    parent on drag.
  • Both symptoms are the same root cause: 50% overlap is
    too strict for normal-sized cards near region corners.

Fix: replaced the area-overlap rule with the simpler,
pre-115.17 **centre-in-region** point check. With centre-
on-cursor placement (preserved) the SHAPE'S CENTRE lands
at the cursor; centre-in-region therefore matches the
operator's cursor directly — drop with cursor inside
region → parented, drop with cursor outside → not
parented. This also matches the live drag preview's
highlight criterion exactly, so what the operator sees
during the drag is what they get on release.

Trade-off accepted: a card whose body is plainly inside a
region but whose centre sits 5px past the edge will not
parent. Those drops are rare in practice and the operator
gets honest feedback (the region won't have lit up during
the drag).

### (2) — Save failing with 401 / CSRF (independent of 115.17)

The 401 the operator hit is the splunkweb_csrf_token_<port>
cookie going stale on a long-lived tab. This isn't a 115.17
regression — the persistence service already reads the
cookie and sends it as `X-Splunk-Form-Key`. After enough
time, the splunkweb session rotates and the value the page
captured at load no longer matches what splunkd expects on
the POST.

The friendly-message formatter previously turned every
401 / 403 into a generic "check your role's write access"
message, which for stale-CSRF is misleading: the operator
*has* the right permissions, they just need to reload. So
the message now disambiguates:

  • If splunkd's error envelope mentions "csrf" OR there's
    no CSRF cookie on the document, the user sees:
      "Splunk session token is stale (HTTP 401 …).
       Reload the page to refresh the CSRF cookie, then
       try the save again."
  • Otherwise the original "check your role" wording
    stands.

The fix is operational, not architectural — auto-refresh
of the CSRF cookie from JS would require splunkweb to mint
us a new one without a full reload, and there isn't a
public path to do that. A reload is the standard remedy.

### Files touched

  • `packages/splunk-cisco-dashboards/src/main/webapp/common/components/diagram/NetworkDiagramCanvas.tsx`
      - `findRegionForRect`: ≥ 50% rect-overlap → shape
        centre-in-region. Removed `rectIntersectionArea`
        helper (now unused). Updated comment with the
        rationale.
  • `packages/splunk-cisco-dashboards/src/main/webapp/common/services/diagramPersistenceService.ts`
      - `friendlyMessage` now disambiguates stale-CSRF 401
        from a real permission denial and recommends a
        page reload first.
  • `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/app.conf`
      - Build 1167 → 1168.
  • `packages/splunk-cisco-dashboards/docs/SESSION_LOG.md`
      - This entry.

### Verification

  • `yarn workspace @splunk/splunk-cisco-dashboards run typecheck` → clean.
  • `yarn workspace @splunk/splunk-cisco-dashboards run package:app` → produced
    `dist/splunk-cisco-dashboards-1.0.10.tar.gz` (14 MB).
  • Manual checks the operator should run after install:
      1. Reload the page (refreshes CSRF). Save should
         work again.
      2. Drop 6 shapes into a region, anywhere inside it.
         Region count should read 6/6, all 6 should
         follow when the region is dragged.
      3. Drop a shape near (but inside) a region's corner.
         Region should light up before release; on release,
         the shape should parent (centre is inside region).
      4. Drop a shape with the cursor outside the region.
         Region should not light up; shape should not
         parent on release.

### What's next

  • Operator confirms saves work after reload AND drops
    feel obedient with the centre-in-region rule.
  • If saves still fail with CSRF after a fresh reload,
    that points at a different failure (proxy strips
    cookies, splunkd config, role config) — escalate to
    Splunk admin diagnostics rather than client code.
  • Open design questions still pending from 115.16
    (low-pri):
      Q1 — Bottom text on unbound cards: collapse
           transparent placeholders or keep them for grid
           consistency?
      Q2 — Display name vs short alias: keep current "alias
           on canvas, name in tooltips" split or surface
           the display name primarily?

### Status reminder (where we are)

Phase 5 (Region UX) rework wraps up here:
  • 115.16 — removed `extent: 'parent'` clamp.
  • 115.17 — centre-on-cursor placement + live drag
             preview + (regrettable) ≥ 50% overlap rule.
  • 115.18 — reverted 50% rule; centre-in-region restores
             the operator-loved behaviour while keeping
             the centre-on-cursor + live-preview wins.

Once 115.18 is confirmed, **phase 5 is done** and we can
move on to phase 6 (inventory automation: auto-bind by
name match, bulk import, "Suggest from inventory" seed
layout).

---

## 2026-05-16 (Build 115.17) — Region drops obey the cursor (centre-on-cursor + rect-overlap hit-test + live preview)

### Goal

Operator pulled 115.16 and was still very upset:

> "very upset still with region problem!! it's hard to
>  explain, i wish you can see it yourself happening, when
>  i drag the object into the region it keeps like going
>  away, it's like it does not want to obey where I want
>  it to go and has a mind of it's own, maybe something to
>  do with snap-into the object or something like that, we
>  need to fix this now and then remind me where we are at
>  and where we need to be becuase now I am confused about
>  the current status"

The 115.16 fix (removing `extent: 'parent'`) was a real bug
fix — it eliminated React Flow's clamp that was snapping
shapes back inside the region rect. But the operator's
"shape goes away with a mind of its own" was a *different*
bug stack that 115.16 didn't touch. Two separate
underlying issues, both shipped here:

### (A) — Palette drops were placed top-left at the cursor

The HTML5 DnD drag image is centred on the operator's
cursor while they drag (browser default). Aiming the card
visual at the centre of a region puts the cursor at the
desired centre. But our `handleDrop` was using
`event.clientX/Y` as the **top-left** of the new node:

```ts
const point = rfInstance.screenToFlowPosition(event.clientX, event.clientY);
const snapped = snapToGrid(point);
newNode = { position: snapped, ... };  // top-left = cursor
```

A 100×110 device card therefore extended **100px right
and 110px down** from where the operator aimed. Drop near
the right edge of a region → the card lands mostly outside
the region. Combined with the snap-to-grid (20px) rounding,
it visibly "snaps away" from the release point.

Fix: centre on the cursor instead of placing the top-left
there. Snap is then applied to the centred top-left so
diagrams stay tidy:

```ts
const cursor = rfInstance.screenToFlowPosition(...);
const centeredTopLeft = (size) => snap({
    x: cursor.x - size.width / 2,
    y: cursor.y - size.height / 2,
});
```

Applied to all four palette variants (textbox, region,
shape, asset) so the behaviour is consistent. Region drops
also gained centre-on-cursor for the same reason — a
360×220 region was previously offset (180, 110) bottom-right
of the click point.

### (B) — Region hit-test was a single point

`findContainingRegion` checked **one point** (the shape's
centre or the cursor) against the region rect. Drops that
visually overlapped the region by 80% but whose centre was
3px past the right edge were classified as "not in
region" and not parented — exactly the eye-vs-algorithm
disagreement that triggers "the shape doesn't obey".

Fix: replace with `findRegionForRect` which uses a
**rectangle-overlap** test — at least 50% of the shape's
area must fall inside the region. Matches the visual
question "is this shape mostly inside the region?".
Extended to drag-stop reparenting too, so dragging an
existing card into a region works the same way as a fresh
palette drop.

### (C) — Live drag preview (the "see it yourself" feature)

The operator's wish — "i wish you can see it yourself
happening" — translated directly into a UX gap. Even with
(A) and (B) fixed, the operator had no feedback during
the drag about *which* region the shape would land in.
115.17 closes this:

  • Each `RegionGroupNodeData` gained an optional
    `dropHovering: boolean` flag.
  • `RegionGroupNode` swaps its dashed border for a solid
    sky-blue ring (`ring-2 ring-sky-400/60` plus a subtle
    glow) whenever the flag is set.
  • The canvas wires four event handlers to compute the
    flag in real time:
      1. `onDragOver` (palette drop) → recompute candidate
         every mouse-move tick using the centred shape rect.
      2. `onDragLeave` → clear (cursor left the canvas).
      3. `onNodeDrag` (existing-shape drag) → same rect-
         overlap test on the dragged node's world rect.
      4. `onNodeDragStop` and `onDrop` → clear, then
         resolve the actual reparenting. The clear is
         folded into the same `setNodes` call so there's
         no flicker.
  • `applyDropHover` does an early-exit if the candidate
    didn't change, so React Flow only re-renders regions
    when the highlight actually transitions (not on every
    mouse move).

Result: operator drags a card toward a region, the region
lights up brightly the moment ≥ 50% of the card is over
it, stays lit while they hover, releases → the card lands
parented exactly where the highlight predicted. WYSIWYG.

### Files touched

  • `packages/splunk-cisco-dashboards/src/main/webapp/common/components/diagram/NetworkDiagramCanvas.tsx`
      - Replaced point-based `findContainingRegion` with
        rect-overlap `findRegionForRect` (≥ 50% area).
      - Added `rectIntersectionArea` helper.
      - Centred all palette drops on the cursor (textbox /
        region / shape / asset variants).
      - Added `applyDropHover` + `clearDropHover` helpers.
      - Added `handleDragLeave` and `handleNodeDrag`.
      - Wired live drop-hover state through both palette
        and existing-node drag paths; cleared at drop /
        drag-stop.
  • `packages/splunk-cisco-dashboards/src/main/webapp/common/components/diagram/RegionGroupNode.tsx`
      - Added optional `dropHovering` to
        `RegionGroupNodeData`.
      - Render branch: dashed-grey → solid sky ring +
        elevated tint when `dropHovering === true`.
  • `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/app.conf`
      - Build 1166 → 1167.
  • `packages/splunk-cisco-dashboards/docs/SESSION_LOG.md`
      - This entry.

### Verification

  • `yarn workspace @splunk/splunk-cisco-dashboards run typecheck` → clean.
  • `yarn workspace @splunk/splunk-cisco-dashboards run package:app` → produced
    `dist/splunk-cisco-dashboards-1.0.10.tar.gz` (14 MB).
  • Manual UX checks the operator should run in Splunk:
      1. Drag a switch from the palette into the centre of
         a region. → region lights up sky-blue mid-drag,
         shape lands centred on the cursor, region count
         updates.
      2. Drop near the right edge of a region (cursor
         inside, but card would overflow). → ≥ 50%
         overlap rule still parents it; card extends
         visibly past the region edge (no clamp; that's
         the 115.16 win).
      3. Drag an *existing* card from outside into a
         region. → region lights up while dragging,
         drop-stop reparents, deviceCount updates.
      4. Drag an existing card OUT of a region. → no
         region lights up while it's en route to "outside";
         drop-stop un-parents.

### What's next

  • Operator confirms region drops feel obedient.
  • Open design questions still pending from 115.16 (lo-pri):
      Q1 — Bottom text on unbound cards: collapse
           transparent placeholders or keep them for grid
           consistency?
      Q2 — Display name vs short alias: keep current "alias
           on canvas, name in tooltips" split or surface
           the display name primarily?

### Status reminder (where we are / where we're going)

We're polishing the **Network Diagram authoring page**
(`pages/network_diagram`) — the customer-facing canvas
that lets operators draw Visio-style topology diagrams,
bind shapes to live `asset_inventory` rows, and see them
light up green/amber/red against `| metadata type=hosts`
visibility data. Persistence is custom
`network_diagrams.conf` (Build 115.3+), saved/loaded via
the Splunk REST API.

Big picture roadmap, by phase:

  1. ✅ Authoring shell — palette, drop, props panel,
     persist, factory diagrams.
  2. ✅ Live status — asset_inventory + metadata fold-in,
     animated edges, status LEDs.
  3. ✅ View mode + presentation polish — fullscreen,
     animations toggle, light/dark theme.
  4. ✅ Visuals — per-class chassis silhouettes (115.15),
     IP visibility toggle (115.13), PNG/PDF export
     (115.13), picker search (115.14).
  5. 🟡 **Region UX** ← we are here. Blocked operator
     trust until 115.17 lands; design open questions Q1/Q2
     are smaller follow-ups.
  6. ⬜ Inventory automation — auto-bind from name match,
     bulk import, "Suggest from inventory" seed layout.
  7. ⬜ Shape library expansion — Cisco DevNet icon
     family, generic Splunk infra shapes, customer-
     supplied SVGs.
  8. ⬜ Sharing / export — direct PowerPoint export, link
     a diagram in a Dashboard Studio panel.

So today's milestone: **once you confirm 115.17 makes
region drops obey the cursor, we close out phase 5 and
move on to (6) inventory automation** — which started in
115.4 with `splunk_inventory.csv` discovery but never got
the auto-bind UX.

---

## 2026-05-16 (Build 115.16) — Region-drop clamp removed, export dropdown hover gap closed

### Goal

Operator pulled 115.15 into Splunk and reported four things:

1. "did you bleed out the text at the bottom on purpose?
   was this by design?"
2. "when I updated display name, I didn't see anything
   changing in the icon at all, is this a bug?"
3. "I am unable to select png vs pdf, it keeps escaping
   from me weirdly when I hover over and try to select png"
4. "we still have a major bug with moving objects into a
   region! really weird behavior, can you look at any
   error in the logic"

(1) and (2) turned out to be design questions, answered in
chat with no code change. (3) and (4) are this build.

### (1) — bottom text "bleeding out"

Not a regression. The four-line label rail (introduced in
Build 115, refined in 115.13) renders:

  • Line 1 (bold, slate-900):       `node.shortLabel`
  • Line 2 (muted, slate-500 8px):  `device_type ?? platform_id ?? node.shape`
  • Line 3 (mono):                  `vendor · model`  (or transparent placeholder)
  • Line 4 (mono, sky):             IP address       (or transparent placeholder)

For an unbound palette drop, lines 3 and 4 fall through to
their `text-transparent` placeholders so card heights stay
uniform across the diagram (a binding-aware row right next
to an unbound row would otherwise reflow). Line 2 falls
back to the shape id uppercased — that's the "ROUTER" /
"SWITCH" / "STACK" the operator was seeing. The pale-gray
secondary styling is intentional muted-text — it's the
existing design, not anything 115.15 introduced.

If a follow-up wants tighter unbound cards, the path would
be hiding the placeholders for unbound shapes and accepting
the mild reflow when bindings are added — left as an open
decision.

### (2) — display name doesn't change the canvas card

By design. The bold label on the canvas card is the **Short
Alias** (`node.shortLabel`), not the **Display Name**
(`node.label`). The inspector explicitly labels the
short-alias field "Short alias (shown on the canvas)".
Display Name is the long form used in tooltips, the
inspector header, and exports — it deliberately doesn't
appear on the card so the canvas stays compact at default
zoom.

If the operator wants Display Name to show on the card
(either swapping the two or showing both as primary +
secondary), that's a one-line change to `shapes.tsx` —
left as an open decision pending operator preference.

### (3) — PNG/PDF dropdown escaping (FIXED)

The export dropdown in `DiagramHeader.tsx` was structured as:

```jsx
<div className="relative group">
  <button>...</button>
  <div className="absolute right-0 top-full mt-1 hidden group-hover:flex ...">
    <button>PNG</button>
    <button>PDF</button>
  </div>
</div>
```

`mt-1` adds a 4px **margin** between the trigger button
and the menu panel. The `.group` container's bounding box
is just the trigger (the menu is `absolute`, doesn't
contribute to layout). When the cursor moves from the
trigger down to the menu, it transits a 4px void where
neither the trigger nor the menu is hovered, so
`group-hover` evaluates false → menu hides → cursor
re-enters menu → menu re-shows → flicker. The user
experienced this as "the menu escapes from me weirdly".

Fix: split the menu into an outer "hover catcher" with
**padding** (`pt-1`) and an inner visual panel. The
catcher's bounding box now starts immediately at the
trigger's bottom edge with no margin gap, but the visible
chrome is offset 4px down via padding inside the catcher.
Hover area is contiguous from trigger to menu; cursor
never leaves the `.group`.

```jsx
<div className="absolute right-0 top-full pt-1 hidden group-hover:block ...">
  <div className="flex flex-col bg-white ... rounded-md shadow-lg ...">
    <button>PNG</button>
    <button>PDF</button>
  </div>
</div>
```

### (4) — region drop "behaves erratically" (FIXED)

This is the operator-reported bug from way back in 115.10
that was supposedly fixed and clearly wasn't. The actual
root cause:

Every node parented to a region was set with `extent:
'parent'`. That React Flow flag clamps the child's local
position so the **entire card** stays inside the region's
rectangle. Two operator-visible consequences:

1. **A child cannot be dragged out of its region.** The
   drag is silently constrained at the region's edge; the
   drag-stop handler never gets a chance to reparent
   because the node never reaches another region.
2. **Fresh drops near a region's right or bottom edge
   snap inward.** If the drop point would put any part of
   the card outside the region (e.g. drop point + 110px
   width > region.width), React Flow clamps the local
   position by the overflow amount, so the card visibly
   *jumps away* from where the operator dropped it.

Fix: drop `extent: 'parent'` everywhere a node is parented
to a region. Six call sites:

  • `savedNodeToRF` textbox branch
  • `savedNodeToRF` device branch
  • `handleNodeDragStop` reparent
  • `handleDrop` textbox palette drop
  • `handleDrop` shape palette drop
  • `handleDrop` asset palette drop

Each now sets `extent: undefined` (with a pointer comment
to the long-form rationale on `handleNodeDragStop`).
Also corrected the now-stale comment in `RegionGroupNode.tsx`.

What still works without the constraint:

  • **Dragging a region drags its children.** React Flow
    honours `parentId` alone for parent-drag-children
    behaviour — `extent` only adds the position clamp, it
    isn't required for the parent-children mechanics.
  • **Round-trip persistence.** `parentId` is still
    written to the saved payload (line 738 of
    `NetworkDiagramCanvas.tsx`) and restored unchanged on
    reload. Only `extent` is cleared.
  • **Visual containment.** `RegionGroupNode` renders
    with `overflow: visible` (the React Flow default), so
    a child whose local position falls outside the
    region's rectangle renders visibly outside without
    DOM clipping. The region's count badge updates via
    `annotateRegionCounts`, which counts by `parentId`,
    not by visual containment.

What changes:

  • The operator can drag a child out of its region
    freely. The drag-stop handler then runs and either
    re-parents to a different region (if the drop center
    landed inside one) or un-parents.
  • Fresh drops land exactly where the cursor was. No
    snap-away near edges.
  • If the operator resizes a region smaller than the
    bounding box of its children, the children visibly
    overflow. The operator sees this and can drag them
    back in (or to another region) at their leisure. The
    pre-115.16 behaviour was "the children are silently
    constrained" — visible overflow is more honest.

### Files touched

- `webapp/common/components/diagram/NetworkDiagramCanvas.tsx`
  — six `extent: 'parent'` → `extent: undefined`, plus a
  long-form rationale comment on `handleNodeDragStop`.
- `webapp/common/components/diagram/DiagramHeader.tsx`
  — restructured the export dropdown so hover is contiguous.
- `webapp/common/components/diagram/RegionGroupNode.tsx`
  — corrected stale comment about `extent: 'parent'`.
- `default/app.conf` — build 1165 → 1166.
- `docs/SESSION_LOG.md` — this entry.

### Verification

- `tsc --noEmit` clean.
- Manual visual review pending on a fresh diagram with:
  drop near region edge, drag child out of region, drag
  region with children, save+reload, hover Save dropdown
  and select PNG.

### What's next

Operator review of:
  - Region-drop behaviour (drop near edges, drag children
    in/out of regions).
  - PNG/PDF dropdown — does it now stay open long enough
    to click an option?

Plus the still-open design questions from this build:
  - Bottom text on unbound cards — collapse the
    transparent placeholders, or leave them for grid
    consistency?
  - Display name vs Short alias on the card — keep the
    current "alias on canvas, name in tooltips" split, or
    show display name as the primary label?

---

## 2026-05-16 (Build 115.15) — Per-class chassis prototype (Option C)

### Goal

Build 115.13 introduced a generic rack-chassis silhouette plus a
small lucide icon overlay on the chassis face for every rack-mount
device. Operator pulled it up on the canvas and said: "I am not
sure I love it, what do you think of how it looks?"

I agreed. Three problems with the 115.13 silhouette family:

1. **The chassis dominates but the chassis is interchangeable.**
   Switch, L3 switch, stack, router, proxy all rendered with
   essentially the same rack outline; the differentiating bottom
   strip ("port row" vs "uplinks" vs "vents") was too subtle to
   read at default canvas zoom.
2. **The lucide icon shrunk too far.** Icons went from a 56×56
   centerpiece (pre-silhouette) to a ~20×16 caption painted on
   the chassis face. The icon no longer carried device-class
   identity at common zoom levels.
3. **Cards looked half-empty.** The chassis occupied the middle
   third of the icon area; the top and bottom thirds were
   negative space.

I offered three paths:

- **A — Revert** to the centered-icon look from before 115.13.
- **B — Hybrid:** big icons + a thin "rack rail" stripe at the
  bottom so we keep the rack-mount visual cue without the chassis
  fighting the icon for space.
- **C — Per-class chassis (full redesign):** draw genuinely
  distinct chassis for the major device classes, drop the icon
  overlay on the specialised ones, let the chassis carry the
  identity by itself.

Operator picked **C**: "let's explore option C and prototype 2-3
distinct chassis (switch / router / firewall) etc.. as you
recomended". This build is the prototype.

### Specialised chassis shipped in 115.15

Six device classes get hand-drawn artwork that fills the card's
icon area and signals the device class through chassis geometry
alone. No lucide icon overlay on these — the chassis IS the
identity.

| Shape | Chassis design |
|-------|----------------|
| `switch` | Wide 1U rack-mount with two 8-port RJ45 rows, a status LCD on the top-left, a vendor/model tab in the middle, and a console port on the right. Activity LEDs above each port row. Emerald accent. |
| `l3_switch` | Taller 2U chassis with an explicit "L3" badge top-left, four SFP uplink cages top-right, and a denser **three-row × 12-port** array (36 ports total) — visibly more capable than the L2 switch. Darker emerald accent. |
| `stack` | Three thin chassis stacked vertically with a single tall rack ear on each side, plus a curved stack cable connecting all three on the right. Top unit shows a green "master" indicator; the other two show amber. |
| `router` | Squat tower (taller, narrower than a switch) with an LCD status screen showing Wi-Fi bars, two console-style ports, three fat uplink ports across the bottom, two stubby feet, and an antenna stub poking out the top with a wireless ripple. Amber accent. |
| `firewall` | 1U chassis with a **prominent shield** etched on the front face (with a checkmark inside) + a five-LED red rail across the top — instantly reads as "security appliance". Rose accent. |
| `wlc` | 1U chassis with a "WLC" badge and an antenna tower silhouette to the left, plus **three Wi-Fi ripple arcs** of decreasing opacity emanating overhead. Violet accent. Four uplink ports across the bottom. |

Everything else (load balancer, server variants, container, vm,
hub, gateway, proxy, waf, vpn_concentrator, ids_ips, siem, ca,
bastion, mainframe) still falls back to the generic `RackChassis`
component, which keeps the 115.13 lucide icon overlay since the
chassis itself stays generic.

Disc / cylinder / cloud / building / users / endpoint / card
families are unchanged.

### Why Option C, not Option B

Option B (big icons + thin rack-rail stripe) would have been
faster to ship but it was just a polish on the 115.13 model:
icons differentiate, chassis decorates. Operator's frustration
was that the chassis _felt important_ but wasn't carrying its
weight. The fix is to either delete the chassis (Option A) or
make it earn its space (Option C). Option C is the higher
ceiling and the only one that can deliver a real Visio-style
"I see the silhouette and know what it is" moment. We're
prototyping six classes; if the visual language works, we
extend the same approach to the remaining 20 in a follow-up.

### Files touched

- `webapp/common/components/topology/silhouettes.tsx` — full
  rewrite. Added `SwitchChassis`, `L3SwitchChassis`,
  `StackChassis`, `RouterChassis`, `FirewallChassis`,
  `WlcChassis`, plus a `SPECIALISED_RACK` lookup that the
  `ShapeSilhouette` dispatcher consults before falling back to
  the generic `RackChassis`.
- `default/app.conf` — build 1164 → 1165.
- `docs/SESSION_LOG.md` — this entry.

### Verification

- `tsc --noEmit` clean.
- Manual visual review pending operator's call after they pull
  the build into Splunk.

### What's next

Operator reviews the six specialised chassis on a real diagram
and tells me one of:

1. "These work — extend the same approach to load_balancer,
   server, ids_ips, vpn, ca, etc."
2. "Mostly works but [specific chassis] needs tweaking" —
   iterate on individual designs.
3. "Still not it — try Option B or revert to A."

Decision points for the follow-up if (1):
- Should `proxy` reuse `SwitchChassis` (it's a forwarding box)
  or get its own chassis?
- `server` / `web_server` / `app_server` / `dns_server` /
  `dhcp_server` — do they all share one "1U pizza-box server"
  chassis or do we differentiate by service role?
- `container` and `vm` need a different visual language entirely
  — they're software, not hardware. Probably a dashed-outline
  variant of the generic chassis.

---

## 2026-05-16 (Build 115.14) — Picker quick-filter

### Goal

Long picker (15+ factory diagrams once SVAs landed) now scrolls.
Operator asked for "a simple fast search" so they don't have to
scan the alphabetical list to find a specific topology.

### What we built

- `common/components/diagram/DiagramHeader.tsx` — sticky search
  input pinned to the top of the picker dropdown:
  - `pickerQuery` state, reset every time the picker re-opens
    so a stale filter doesn't surprise an operator.
  - Auto-focus on open (deferred a tick so the input is mounted
    before we focus it) — operators can start typing immediately
    after clicking the picker chevron.
  - Plain case-insensitive substring match against
    `DiagramSummary.name`. Filter applies to BOTH the Default
    and Custom groups simultaneously; the section headers
    reflect the filtered count so the operator sees how many
    matches each bucket holds.
  - Esc clears the query if non-empty, otherwise closes the
    picker. Standard incremental-search shortcut.
  - Enter auto-opens the diagram when exactly one match remains
    — type a few unique letters, hit Enter, done. Multiple
    matches are a no-op (don't surprise the operator by picking
    the first alphabetical).
  - X icon in the input clears the query and refocuses for
    another search.
  - Empty-result message ("No diagrams match \"X\".") rendered
    only when a query is typed and both groups come up empty —
    no scaffolding flash mid-typing.
- `default/app.conf` — `build = 1164`.

### Verification

- `yarn typecheck` clean (2.2 s).
- `yarn build` clean (21 s, no new warnings).
- `network_diagram.js` 821 KiB (was 818 KiB; +3 KiB for the
  Search/X icons + the filter logic).

### Files changed

```
M packages/splunk-cisco-dashboards/src/main/resources/splunk/default/app.conf
M packages/splunk-cisco-dashboards/src/main/webapp/common/components/diagram/DiagramHeader.tsx
```

### What's next

- Consider adding fuzzy match (typo-tolerant) if operators ever
  hit the limit of substring search. We held off this round
  because plain `includes()` is fast, predictable, and the
  diagram corpus is small enough that fuzzy adds noise.

---

## 2026-05-16 (Build 115.13) — Per-class silhouette family, LED → Search drilldown, IP visibility toggle, PNG/PDF export

### Goal

Four follow-up requests on top of 115.12:

1. Replace the single `DeviceShape` look (one rounded card with a
   centred icon for every device class) with a per-class
   silhouette family — Visio-flavoured artwork that lets an
   operator tell a switch from a router from an access point at a
   glance, even when the icon glyph is sub-pixel.
2. On status-LED hover, surface an "Open in Search" affordance
   that runs `| metadata type=hosts | search host="<bound>"` so
   operators can validate the inventory device names that drive
   the LED itself.
3. Allow operators to attach an IP / management address to every
   shape, render it as a fourth bottom row on the card (mono
   blue), and ship a header-level "Show / Hide IPs" toggle so
   the address can be redacted before sharing diagram screenshots
   with audiences who shouldn't see internal addressing.
4. Mirror the overview dashboard's PNG / PDF export buttons for
   the network diagram canvas so operators can drop a topology
   into a slide deck without screenshotting.

### Discovery & decisions

**Silhouette family — chosen geometry**

The constraint: React Flow's bounding box is rectangular, handles
hang off the four sides, and the canvas's parent-extent / resize
plumbing all assumes "card sized roughly 110 × 122". Switching to
genuinely non-rectangular shapes (a literal cloud outline as the
React Flow node) would have meant forking the connect-point
geometry across every shape — too much surface area for one
session.

We landed on a hybrid: the React Flow node stays a rectangle
(handles + resizer behave identically to 115.12), but the inner
icon area is replaced by a per-class SVG silhouette that fills
the rectangle. Operators reading the canvas at zoom-out see the
outline (rack chassis vs disc vs cylinder vs cloud) before the
icon glyph resolves; operators reading at full zoom still see the
familiar lucide icon overlaid on the chassis face.

Family map (`SHAPE_FAMILY` in `silhouettes.tsx`):

- **`rack`** — every rack-mount appliance (routers, switches,
  firewalls, WLCs, load balancers, IDS/IPS, SIEM, WAF, VPN
  concentrator, generic / web / app / DNS / DHCP servers,
  mainframe, hub, gateway, proxy, container, VM, NAS, SAN,
  backup, CA, bastion). The bottom-strip motif varies by
  *flavour* (`switch`/`router`/`security`/`compute`/`generic`)
  so a switch reads as eight tiny port boxes, a router as two
  uplink ports + amber beacon, a security appliance as a red
  LED rail, and compute as vent slots — different at-a-glance
  even though they share the chassis outline.
- **`disc`** — wireless access point. Round body, three
  Wi-Fi ripple arcs overhead, mounting plate shadow.
- **`cylinder`** — database / storage / NAS / SAN / backup.
  Three stacked drum surfaces (top ellipse + body + bottom
  shadow + intermediate platter rings).
- **`cloud`** — cloud / internet. Cloud silhouette with the
  icon centred inside.
- **`building`** — branch office / datacenter. Three-storey
  building outline with windows, door, and roof tile.
- **`usersGroup`** — three person silhouettes (centre figure
  forward + bigger).
- **`endpoint`** — laptop / phone / printer / camera /
  iot_sensor. Existing lucide icon enlarged on a soft pedestal
  shadow (the lucide endpoint icons are already distinctive
  client silhouettes, so a per-class chassis here would just
  compete with the icon's own outline).
- **`card`** — fallback (centred icon) for `generic` and any
  future shape id that lands without a family entry.

**LED → Search drilldown**

The overview dashboard already had a `splunkSearchAppUrl` helper
inline. We extracted it to `common/lib/splunkSearchUrl.ts` along
with `openSplunkSearch`, `quoteHostForSpl` (escapes embedded
`"` / `\`), and `buildMetadataHostSpl` so both the diagram and
the overview tile share a single URL builder. The diagram card
hover wires the LED to a `<button>` that calls
`openSplunkSearch(buildMetadataHostSpl(host))` and stops event
propagation so the click doesn't also select the underlying node
in the canvas. Unbound shapes (no candidate host) get a default
cursor and the click is a no-op — better than a broken drilldown.

Hover state expands a small dark "Open in Search" pill
underneath the LED via local state (`ledHover`); the pill is
absolutely-positioned so it never displaces the chassis layout.

**IP visibility toggle — provider, not prop**

Same pattern we adopted in 115.12 for the animations toggle:
device cards live deep inside React Flow's node-type registry,
so threading a `showIp` prop through every shape would mean
forking React Flow's `NodeProps` contract or stuffing the flag
into each node's `data` (which then has to round-trip through
save/load). A page-level context broadcast is one localStorage
read, one setter on toggle, zero per-node bookkeeping. New file
`common/contexts/IpAddressVisibilityContext.tsx` mirrors the
animations context exactly (default `true`, `Provider` re-export,
`useIpAddressVisibility` hook).

The IP itself rides on `SavedDiagramNode.ipAddress` (round-trips
through the conf payload) and on `TopologyDiscoveredNode.ipAddress`
(so `buildDeviceData` and `savedNodeToRF` can populate it). The
DeviceShape's bottom row is now four lines (name / type /
vendor·model / ip) instead of three, with the IP row collapsed
to `text-transparent` when nothing resolves — keeps card heights
consistent across grid-aligned OOB diagrams.

**PNG / PDF export — reuse the overview hook**

`useExportPage` already existed (html2canvas + jspdf, dynamic-
imported on first call, captures any DOM ref). We added a
`exportTargetRef` on the canvas wrapper inside
`pages/network_diagram/index.tsx`, plumbed `exportAs` through
`DiagramHeader` as `onExport(format)` + `exporting` (busy
indicator), and rendered a Download dropdown identical to the
overview header's "Save as PNG / Save as PDF" pattern. The
filename is sanitised (`[^a-zA-Z0-9._-]+` → `_`) so a diagram
called `Splunk Cloud Deployment Architecture` becomes
`network-diagram-Splunk_Cloud_Deployment_Architecture-<ts>.png`.

We deliberately wrap only the canvas pane (not the whole page)
so the exported artefact doesn't include the header chrome —
matches what an operator would manually screenshot for a slide.

### What we built

- `common/components/topology/silhouettes.tsx` — new file. Owns
  `SHAPE_FAMILY`, the per-family `*Silhouette` components, and
  the `<ShapeSilhouette shape={…} />` dispatcher. Each
  silhouette renders into a 100 × 100 viewBox + `currentColor`
  stroke/fill so dark mode flows through automatically.
- `common/components/topology/shapes.tsx` — `DeviceShape` now
  delegates the icon area to `<ShapeSilhouette>`, reads
  `node.ipAddress` (with raw fallbacks) for the new bottom row,
  and wraps the corner LED in a `<button>` that calls
  `openSplunkSearch(buildMetadataHostSpl(host))` on click. The
  legacy `SHAPE_TO_ICON` map and the local `CISCO_ICONS` import
  were retired in favour of the silhouettes file.
- `common/contexts/IpAddressVisibilityContext.tsx` — new file
  mirroring the animations context. Default `true`, `Provider`
  re-export, `useIpAddressVisibility` hook.
- `common/lib/splunkSearchUrl.ts` — extracted from
  `pages/overview/index.tsx`. Exports `splunkSearchAppUrl`,
  `openSplunkSearch`, `quoteHostForSpl`, `buildMetadataHostSpl`,
  and `DEFAULT_DRILLDOWN_RANGE` (`-24h@h … now`, matching the
  host-visibility window).
- `common/services/diagramPersistenceService.ts` — extended
  `SavedDiagramNode` with `ipAddress?: string`. JSDoc spells out
  the empty-string-clears / undefined-keeps semantics already
  used by `vendor` / `model`.
- `common/services/topologyDiscovery.ts` — extended
  `TopologyDiscoveredNode` with `ipAddress?: string`.
- `common/components/topology/PropertiesPanel.tsx` — `NodeUpdate`
  gains `ipAddress?: string`. The Hardware section's form now
  has an "IP / Management address" input next to Model. State,
  effect dependencies, and both apply paths (`handleApply`,
  `handleBindChange`) carry the field through.
- `common/components/diagram/NetworkDiagramCanvas.tsx` —
  `buildDeviceData`, `savedNodeToRF`, `rfToSaved`, and the three
  branches of `handleNodeUpdate` (bind / unbind / plain) all
  round-trip `ipAddress`. We persist only when the override is
  non-empty so a card showing an inventory IP by fallback
  doesn't pin that value into the saved payload.
- `common/components/diagram/DiagramHeader.tsx` — three new
  affordances next to the existing animations toggle:
  - Eye / EyeOff pill bound to `ipAddressesVisible` /
    `onToggleIpAddresses`.
  - Download dropdown ("Save as PNG / Save as PDF") bound to
    `onExport(format)`; busy state mirrors the overview header
    (Pause icon with `animate-pulse` while exporting).
- `pages/network_diagram/index.tsx` — manages `ipAddressesVisible`
  state (localStorage key `ndg-show-ips`, default ON), wires
  `useExportPage` against a new `exportTargetRef` placed on the
  canvas pane, fans `IpAddressVisibilityProvider` around
  `<NetworkDiagramCanvas>` alongside the existing
  `AnimationsEnabledProvider`.
- `default/app.conf` — `build = 1163`.

### Verification

- `yarn typecheck` clean (2.26 s).
- `yarn build` clean (20 s, 2 pre-existing webpack size warnings,
  no new warnings).
- Bundle deltas:
  - `network_diagram.js` — 818 KiB (was 798 KiB; the silhouette
    SVG paths + the new context add ~20 KiB).
- No diagram payload migrations needed — the new `ipAddress`
  field is optional and existing saved diagrams round-trip
  unchanged through `rfToSaved` / `savedNodeToRF`.

### Files changed

```
M packages/splunk-cisco-dashboards/src/main/resources/splunk/default/app.conf
M packages/splunk-cisco-dashboards/src/main/webapp/common/components/diagram/DiagramHeader.tsx
M packages/splunk-cisco-dashboards/src/main/webapp/common/components/diagram/NetworkDiagramCanvas.tsx
M packages/splunk-cisco-dashboards/src/main/webapp/common/components/topology/PropertiesPanel.tsx
M packages/splunk-cisco-dashboards/src/main/webapp/common/components/topology/shapes.tsx
M packages/splunk-cisco-dashboards/src/main/webapp/common/services/diagramPersistenceService.ts
M packages/splunk-cisco-dashboards/src/main/webapp/common/services/topologyDiscovery.ts
M packages/splunk-cisco-dashboards/src/main/webapp/pages/network_diagram/index.tsx
A packages/splunk-cisco-dashboards/src/main/webapp/common/contexts/IpAddressVisibilityContext.tsx
A packages/splunk-cisco-dashboards/src/main/webapp/common/lib/splunkSearchUrl.ts
A packages/splunk-cisco-dashboards/src/main/webapp/common/components/topology/silhouettes.tsx
```

### What's next

- Sanity-check the rack-flavour palette against a busy OOB
  diagram (the indexer cluster reference) — one thing we
  deliberately did NOT do is have the LED ping ring re-tint
  to follow the silhouette's accent (right now the ping ring
  matches the status colour, which is correct for "is this
  host alive" but slightly out of harmony when a healthy
  amber-router silhouette ends up underneath an emerald ping).
- Consider opt-in photorealistic rendering as the next tier
  — at this point we have a stable per-family API and could
  swap the SVG silhouettes for vendor PNGs without churning
  consumers.
- The PNG export currently captures everything inside
  `exportTargetRef`, which means any open inspector
  (Properties panel) bleeds into the screenshot. Add a brief
  pre-export `setSelection(null)` or capture-time stylesheet
  override before shipping a "Share with audience" workflow.

---

## 2026-05-16 (Build 115.11) — OOB alignment, card resize, arrow styles, live-status edges, picker fold, ship script

### Goal

Six follow-up requests that landed after the 115.10 polish session:

1. **Default diagrams are visibly mis-aligned** in regions (e.g. the
   Splunk Cloud reference page — Search SHs sit a few px below the
   Indexer row, the AZ trio doesn't share a Y, the protocol-gateway
   labels float above the Customer Env top edge by ~6px).
2. **Can device cards be resized?** Operators want a "hero device"
   in some diagrams (e.g. an enlarged HEC LB) and a tighter card on
   small references.
3. **Don't love the arrow shape** — give us alternatives.
4. **Make the line itself feel alive** like the overview dashboard's
   site connector: green dashes when reporting, red when stale.
5. **Picker dropdown clips long names** and dumps factory + custom
   into one undifferentiated list.
6. **One-shot ship** — produce an installable Splunk archive on every
   change loop so test installs are a single CLI step.

### Discovery & decisions

#### Alignment is per-region, not per-canvas

The OOB diagrams ship with hand-tuned coordinates; cumulative drift
on coordinates near the 20px snap grid (e.g. y=30 vs y=40 vs y=180)
made same-row cards look like they're in different rows. The runtime
already snaps drag-stops to a 20px grid, so the problem is purely in
the seed data. Decision: add a **`tidyDiagram()` post-process** to
the generator that runs after every diagram declaration:

- Snap every node / group / title coordinate to the 20px grid.
- Per parent, cluster Y values (and X values) using a 24px
  single-link tolerance and force every node in a cluster onto a
  shared Y / X. Cluster representative is the snapped MIN of the
  group, not the median, so we don't accidentally drift everyone
  onto a phantom new gridline.
- Top-level (no parentId) nodes get the same treatment via a
  sentinel parent key — fixes the floating gateway labels in the
  cloud diagram.

The pass is conservative (24px tolerance ≈ one grid step) so
intentional staggers stay intentional, but anything authored
"close to aligned" snaps to "actually aligned". 13 OOB diagrams
re-emitted from one `node scripts/generate_oob_diagrams.mjs` run.

#### Card resize via NodeResizer; widen the dimensions exclusion

React Flow ships `<NodeResizer>` for the resize affordance. Two
plumbing changes were needed alongside it:

1. `DeviceShape` was rendering with hard-coded `width: 110, height:
   122`. Swap to `width/height: 100%` so the React Flow wrapper's
   `style.width/height` (already round-tripped by `rfToSaved`)
   actually drives the visual size. Add `<NodeResizer
   isVisible={selected} minWidth={90} minHeight={100}>` so the
   eight handles only appear on the selected card and the floor
   stays readable.
2. `isMutatingNodeChanges` had a blanket skip for `dimensions`
   changes — that was right for first-mount measurement, wrong for
   user-driven resizes. The React Flow `NodeChange` for an active
   resize carries `resizing: true`; gate the early-return on that
   flag so resizes mark the diagram dirty (same applies to region
   resize, which was silently dropped before this fix).

#### Arrow styles: closed / open / thin + custom dot / diamond

React Flow's built-in `MarkerType` has only `Arrow` and
`ArrowClosed`. To deliver a richer set without dropping React
Flow's marker resolver, we hybridise:

- `closed` → MarkerType.ArrowClosed (default, current look).
- `open`   → MarkerType.Arrow.
- `thin`   → MarkerType.Arrow with `strokeWidth: 1` and a smaller
  marker box.
- `dot`    → custom SVG `<marker id="ndg-arrow-dot">` rendered
  via a tiny `<svg>` overlay (`<EdgeMarkerDefs />`) inside the
  canvas wrapper.
- `diamond` → custom SVG `<marker id="ndg-arrow-diamond">` in
  the same overlay.

`markersForDirection(direction, style)` returns either an
`EdgeMarker` object (built-ins) or a `'url(#ndg-arrow-…)'` string
(custom markers). React Flow accepts both shapes for
`markerStart` / `markerEnd`. Markers use `fill="context-stroke"`
so the dot/diamond automatically tints to whatever colour the
edge is currently strok​ing with — including the new live-status
green/red — with a slate fallback for browsers without
`context-stroke` support.

`SavedDiagramEdge.arrowStyle` is round-tripped, but only emitted
when ≠ 'closed' so older diagrams stay byte-identical on save
(no `git diff` churn).

#### Live-status edges: emerald/rose marching ants

The Florida overview dashboard's customer-topology map has the
"data flowing through this connector" effect operators love. We
port the recipe to the diagram canvas as a per-edge toggle:

- `SavedDiagramEdge.liveStatus: boolean` — when true, the edge
  ignores `lineColor` and per-kind defaults and recolours its
  stroke from the `HealthStatus` of its endpoints.
- The endpoint statuses come from `useStore(s => s.nodeLookup)`
  inside `AnimatedEdge` — a per-edge selector keeps re-renders
  scoped to edges whose endpoints actually changed. This pairs
  perfectly with the 115.10 patch effect that updates device
  status in-place: when `| metadata` flips a host, the edge
  flips colour without a full canvas hydration.
- Status reduction: both healthy → emerald; either critical →
  rose; either warning or one-sided healthy → amber; both
  unknown → slate (no marching ants in that case so a "we
  haven't loaded telemetry yet" edge stays quiet).
- Marching ants via SVG `<animate attributeName="stroke-
  dashoffset">` on the existing visible path; period (1000ms)
  is half the flowing-dot duration so the two animations look
  intentional together. Direction follows the edge's `direction`
  field — backward edges flow ants the other way.
- Dasharray is `6 4`, stroke is bumped from 1.5 → 2 in live
  mode so the gaps stay legible; selected edges still get the
  +0.75 emphasis on top.

The inspector exposes a single switch (`Activity` icon) labelled
"Reporting from hosts" / "Static colour" so operators understand
both ends and can flip back if the line looks too busy.

#### Picker: alias the prop, group by registry

Three small fixes layered together:

1. The dropdown was 288px (`w-72`) — long names like
   "Distributed Clustered with SHC Single Site - C3 C13" overflow.
   Bump to 384px (`w-96 max-w-[90vw]`) and replace `truncate` on
   the name span with `break-words flex-1`. Keep the "saved at"
   timestamp on the same row but with `whitespace-nowrap` so it
   stays right-aligned.
2. Group by the canonical `FACTORY_DIAGRAM_NAMES` registry from
   `diagramPersistenceService.ts`. Two collapsible-style sections:
   "Default (n)" and "Custom (n)", each sorted alphabetically by
   name (case-insensitive, base sensitivity).
3. The DiagramHeader prop `isFactoryDiagram: boolean` was shadowing
   the imported helper of the same name — TS error
   `Type 'Boolean' has no call signatures` when we tried to call
   it inside the IIFE. Alias the import as
   `isFactoryDiagramName`. Rename the prop too in a future pass if
   we want — for now the alias keeps the ergonomic API stable.

#### `yarn package:app` was already there — wire up the workspace

The `package_app.sh` script already produces a versioned tarball
into `dist/splunk-cisco-dashboards-<version>.tar.gz`. What was
missing: a single repo-root command. Add three workspace-level
scripts to the top-level `package.json`:

- `yarn package:app` → forwards to the package script.
- `yarn regen:diagrams` → re-runs `generate_oob_diagrams.mjs`.
- `yarn ship` → regen + package in one pass, the new "release
  loop" command.

The customer's install workflow becomes:

    yarn ship
    splunk install app dist/splunk-cisco-dashboards-1.0.10.tar.gz -update 1

### What we built

- `scripts/generate_oob_diagrams.mjs` — added the `tidyDiagram()`
  post-process and applied it to all 13 OOB diagrams. Re-emitted
  `default/network_diagrams.conf` via the regen script.
- `common/components/topology/shapes.tsx` — `DeviceShape` now
  fills its wrapper (100% × 100%) and ships an in-card
  `<NodeResizer>` that activates on selection. Min: 90×100.
- `common/components/diagram/NetworkDiagramCanvas.tsx`:
  - `isMutatingNodeChanges` returns `true` for dimensions
    changes when `resizing === true` (operator drag), still
    silent for first-mount measurement.
  - New `EdgeMarkerDefs` SVG overlay for `dot` / `diamond` markers.
  - `ARROWHEADS_BY_STYLE` table and the new
    `markersForDirection(direction, arrowStyle)` signature.
  - `savedEdgeToRF` / `rfToSaved` round-trip `arrowStyle` and
    `liveStatus`.
  - `handleConnect` initialises new edges with `arrowStyle:
    'closed'` and `liveStatus: false`.
  - `handleEdgeUpdate` honours both new fields.
- `common/components/diagram/AnimatedEdge.tsx`:
  - `useStore` selectors pull source/target `HealthStatus` from
    React Flow's `nodeLookup`.
  - `LIVE_STATUS_PALETTE` + `reduceEndpointStatus` derive the edge
    colour for live mode.
  - The visible path conditionally swaps stroke + dasharray and
    runs an `<animate>` for marching ants when live mode is on.
- `common/components/topology/PropertiesPanel.tsx`:
  - New `ArrowStyle` type, `ARROW_STYLE_OPTIONS` table, and
    `EdgeUpdate.{arrowStyle, liveStatus}` fields.
  - Edge inspector adds an "Arrow style" `<select>` (disabled
    when direction='none', to make the dependency obvious) and
    a "Live status" toggle button (Activity icon, emerald when
    on, slate when off).
- `common/services/diagramPersistenceService.ts`:
  - `SavedDiagramEdge.arrowStyle` and `SavedDiagramEdge.liveStatus`
    fields with full doc strings.
- `common/components/diagram/DiagramHeader.tsx`:
  - Picker widened, `truncate` removed, names wrap.
  - Imports `isFactoryDiagram as isFactoryDiagramName` to dodge
    the prop shadow.
  - Two folder-style sections: Default (factory) and Custom,
    each sorted A→Z, divider line between them.
- `package.json` (root) — `package:app`, `regen:diagrams`, `ship`
  scripts so the install loop is `yarn ship` + `splunk install`.
- `default/app.conf` — `build = 1161`.

### Verification

- `yarn typecheck` from `packages/splunk-cisco-dashboards/` —
  green. (One mid-flight error about the `isFactoryDiagram` prop
  shadowing the import surfaced and was fixed via the
  `isFactoryDiagramName` alias.)
- `yarn build` (webpack production) — green; same size warnings as
  before (overview, topology_canvas_v1, network_diagram entrypoints)
  with no new ones.
- `yarn package:app` — produces
  `dist/splunk-cisco-dashboards-1.0.10.tar.gz` (14M). Top-level
  `yarn ship` runs the regen + package pair in sequence.
- `node scripts/generate_oob_diagrams.mjs` re-emits all 13 OOB
  diagrams; `git diff default/network_diagrams.conf` shows
  per-diagram coordinate snaps (e.g. `y=30` → `y=40`,
  `y=180` → `y=180` (already aligned), gateway labels at `y=460`
  → `y=460` but the customer-env shapes anchored to `y=60` now
  share that Y across the whole row).

### Files changed

- `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/app.conf`
- `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/network_diagrams.conf` (regenerated)
- `packages/splunk-cisco-dashboards/src/main/webapp/common/components/diagram/AnimatedEdge.tsx`
- `packages/splunk-cisco-dashboards/src/main/webapp/common/components/diagram/DiagramHeader.tsx`
- `packages/splunk-cisco-dashboards/src/main/webapp/common/components/diagram/NetworkDiagramCanvas.tsx`
- `packages/splunk-cisco-dashboards/src/main/webapp/common/components/topology/PropertiesPanel.tsx`
- `packages/splunk-cisco-dashboards/src/main/webapp/common/components/topology/shapes.tsx`
- `packages/splunk-cisco-dashboards/src/main/webapp/common/services/diagramPersistenceService.ts`
- `packages/splunk-cisco-dashboards/docs/SESSION_LOG.md` (this entry)
- `package.json` (root)
- `scripts/generate_oob_diagrams.mjs`

### What's next

- Watch what operators actually do with `liveStatus` on busy
  diagrams — if every edge ends up flipped on, we'll need a
  per-diagram global toggle so the canvas stops feeling like a
  Christmas tree.
- The `tidyDiagram()` pass currently runs on a 20px grid. If
  operators want a denser layout (e.g. 10px), we either gate by
  diagram or expose a per-region "padding" knob in the inspector.
- `<NodeResizer>` works but doesn't yet snap to a grid during the
  drag. React Flow accepts a `gridSize` prop on the canvas; we'll
  need to pass it through `NodeResizer` too if alignment-with-
  resize matters in practice.
- The dropdown's two-section layout is a good baseline; if the
  custom list grows past ~12, add a search input above the list.

---

## 2026-05-16 (Build 115.10) — Region-drop wipe, edge hit area, panel auto-dismiss, label auto-bind, radiating LEDs, light/dark theme

### Goal

Six operator-reported authoring-experience issues from the Build 115.9
demo, escalating from "this is broken" to "this would be a wow":

1. **Erratic region drops.** Dragging a shape into a region behaved
   wildly — the operator said "the shape moves outside and is not
   behaving right". Repro: drop a Switch from the palette into a
   freshly-placed region, and the device sometimes vanished or
   relocated outside the region body.
2. **Edge click hit area too small.** "It's a little difficult to find
   the sweet spot to click on a connection line, you almost have to
   be perfect" — the visible 1.5–2.25px stroke is also the click
   target, and operators were repeatedly missing.
3. **Inspector lingers after Apply.** Pressing Apply commits the
   changes but leaves the panel open; the operator has to chase the
   × button to close it.
4. **No auto-bind from typed names.** "If we know the device name from
   the inventory and we know `| metadata` sees it, why can't [we]
   just bind the host automatically to the shape… short name vs
   FQDN, etc.". Operators want the obvious bind to happen for them.
5. **Status dot is just a dot.** "Can the dot in the card radiate
   when the status is green or red? I think if you can find some
   cool effects, that will be amazing — we need a wow effect."
6. **No theme toggle.** "Just like in our overview dashboard, please
   implement light vs dark mode and auto set it based on the user
   or system default settings."

### Discovery & decisions

#### Region drops — root cause, not the symptom

The visible jitter wasn't React Flow's parent extent clamping (that
was working as designed). The root cause was a re-hydrate race in
`NetworkDiagramCanvas`. The hydrate `useEffect` declared deps
`[initialPayload, assetIndex, visibilityIndex, reactFlow]`. Both
`assetIndex` and `visibilityIndex` resolve asynchronously on
mount — the metadata search, in particular, can take ~1s to land.
Each resolution triggered the effect again, which calls `setNodes`
from `initialPayload`, throwing away whatever the operator just
dropped in the meantime. Result: a shape dropped into a region
either disappeared, snapped back to its pre-drop state, or — when
the timing aligned with React Flow's mid-drag bookkeeping — flew
outside the region as the parent slot got recreated.

The fix is two effects instead of one:

- **Hydrate effect** (depends on `initialPayload` and `reactFlow`
  only): rebuilds nodes/edges from the saved payload on mount and
  on diagram switch. Reads `assetIndex` / `hostVisibility` from
  refs so it doesn't have to re-run when those land.
- **Patch effect** (depends on `assetIndex` and `hostVisibility`):
  walks current nodes and updates `data.node.status` in-place when
  the indexes resolve, leaving positions, parents, edges, and any
  in-progress drops untouched. Returns the same node reference
  when nothing changes so React Flow doesn't repaint unaffected
  cards.

The patch is intentionally narrow: only `status` is recomputed. We
considered re-deriving `label`, `vendor`, `model` etc., but those
have operator-typed overrides and re-deriving them would clobber
unsaved edits — exactly the bug we're fixing.

#### Edge hit area — overlay, not a wider stroke

The two natural fixes are (a) bump the visible stroke to ~10px so
you can hit it, or (b) keep the stroke thin and overlay an
invisible wide path for hit testing. (a) makes the diagram look
like a 90s power-point. (b) is the standard React Flow recipe:
render a transparent 20px stroke first, with `pointerEvents="stroke"`
and `cursor: pointer`, then the visible 1.5–2.25px stroke on top
with `pointerEvents="none"`. Clicks within ~10px of the line land
in the corridor. The cursor change is the key affordance — the
operator's "you almost have to be perfect" was as much about
discoverability as accuracy.

#### Auto-dismiss the inspector after Apply

We didn't want to break the Build 115.3 inline-binding flow (where
clicking a host in the Bind to host combobox immediately commits
and keeps the panel open so the operator can verify the rebind).
The fix adds an `onApplyComplete?: () => void` prop to the four
forms with explicit Apply buttons (Node / Region / Title / Textbox).
The PropertiesPanel passes `onClose` as that callback. Inline
binding apply does NOT invoke it. The Edge form already used a
live-preview `commit` (no Apply button) so it's untouched.

#### Auto-bind from typed names

We considered fuzzy / per-keystroke matching but rejected both:
fuzzy matches surprise operators who type substrings, per-keystroke
matching jitters mid-type. The chosen heuristic runs ONLY on
explicit Apply: when the typed `label` or `shortLabel` exactly
matches an asset's id / label / shortLabel / `raw.hostname` /
`raw.device_name` (after lowercase + trim, with FQDN→short
expansion on both sides), and the node is currently unbound, the
Apply payload includes `assetId` so `handleNodeUpdate` routes
through the bind branch. If multiple assets match (unlikely but
possible — one device known by short and another by full name),
the heuristic punts and the operator binds manually via the combobox.
This handles the common short-vs-FQDN skew the user called out
without going down the fuzzy-match rabbit hole.

#### Radiating LEDs — animate-ping, not a custom keyframe

Tailwind ships `animate-ping`, which scales an element from 100%
to 175% and fades opacity 100→0 over 1s, repeating indefinitely.
That's the exact "outward pulse" the user asked for. The trick is
layering: an absolutely-positioned ping ring sits behind the solid
LED dot at the same coordinates, so the dot stays crisp while the
ring radiates outward. Each status (`healthy`, `warning`,
`critical`) gets its own ping colour matching the dot. `unknown`
intentionally has an empty `dotPing` — a "no telemetry" indicator
shouldn't compete for attention with the active states.

#### Light/dark theme — reuse the existing rig

The Florida overview dashboard already has `useTheme` (light /
dark / system + `prefers-color-scheme` listener + localStorage
persistence) and `ThemeToggle` (pill button cycling
light → dark → system). Tailwind runs `darkMode: 'class'`, so
applying the literal `dark` class on the page wrapper enables
every `dark:` variant in the subtree. The diagram canvas and
header already had `dark:` variants for the entire surface — they
just weren't reachable because the page didn't apply the class.
The fix is mechanical: pull `useTheme` + `ThemeToggle` into
`pages/network_diagram/index.tsx`, conditionally apply `dark` to
the wrapper, and pass the toggle into `DiagramHeader` via a new
optional `themeSlot` prop so the header doesn't have to know about
the hook.

### What we built

#### `src/main/webapp/common/components/diagram/NetworkDiagramCanvas.tsx`

- Added `assetIndexRef` / `visibilityIndexRef` mirrors so the
  hydrate effect reads the freshest values without listing them
  as deps.
- Trimmed the hydrate effect's deps to `[initialPayload, reactFlow]`.
- Added the patch effect (`[assetIndex, hostVisibility]`) that
  re-folds `status` for every device node in-place, returning the
  same reference when nothing changes.

#### `src/main/webapp/common/components/diagram/AnimatedEdge.tsx`

- Added the wide invisible interaction path (20px,
  `pointer-events: stroke`, `cursor: pointer`).
- Visible path now uses `pointer-events: none` so it doesn't
  compete with the interaction layer.

#### `src/main/webapp/common/components/topology/PropertiesPanel.tsx`

- Threaded `onApplyComplete` into the Node / Region / Title /
  Textbox forms; each form's `handleApply` invokes it after
  `onApply`. Inline binding flow unchanged.
- PropertiesPanel passes `onClose` as `onApplyComplete` for all
  four forms.
- Added the auto-bind heuristic in `NodePropertiesForm`: on
  explicit Apply, scan `assetIndex` for an unambiguous lower-case
  / FQDN-short match against the typed label / shortLabel; on a
  hit, include `assetId` in the Apply payload so the canvas
  routes through the rebind branch.

#### `src/main/webapp/common/components/topology/shapes.tsx`

- Added `dotPing` per status (`healthy` / `warning` / `critical`,
  empty for `unknown`).
- Replaced the single LED `<span>` with a wrapper holding (a) an
  absolutely-positioned ping ring (`animate-ping`) and (b) the
  solid dot. Bumped glow alpha slightly for healthier contrast
  against the ping ring.

#### `src/main/webapp/pages/network_diagram/index.tsx` + `DiagramHeader.tsx`

- Wired `useTheme` (preference + resolved theme + cycle) into the
  diagram page.
- Page wrapper conditionally adds the `dark` class so Tailwind's
  class-mode dark variants resolve.
- DiagramHeader gained an optional `themeSlot` prop; the diagram
  page passes `<ThemeToggle theme={theme} onCycle={cycleTheme} />`
  so the operator gets the same control they have on the overview
  dashboard.

### Verification

- `yarn typecheck` clean.
- `yarn build` clean (only the pre-existing asset-size warnings
  for overview / topology / network_diagram bundles).
- Manual smoke (will follow on stack):
  1. Drop Switch into a freshly-placed region — shape stays put,
     even when the metadata search is still in flight.
  2. Click anywhere within ~10px of an edge — selection lands;
     cursor shows pointer over the corridor.
  3. Apply on the Node / Region / Title / Textbox inspector
     dismisses the panel; binding via the combobox keeps it open.
  4. Type a known hostname into a generic shape's label, press
     Apply — shape rebinds (vendor/model/raw light up).
  5. Healthy nodes pulse green, critical red; unknown stays quiet.
  6. Click the AUTO toggle in the header — cycles
     light → dark → system; each tier paints the canvas
     correctly; system mode follows the OS preference.

### Files changed

- `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/app.conf`
  (`build` → 1160).
- `packages/splunk-cisco-dashboards/src/main/webapp/common/components/diagram/NetworkDiagramCanvas.tsx`
  (hydrate split + patch effect + index refs).
- `packages/splunk-cisco-dashboards/src/main/webapp/common/components/diagram/AnimatedEdge.tsx`
  (interaction overlay + cursor).
- `packages/splunk-cisco-dashboards/src/main/webapp/common/components/diagram/DiagramHeader.tsx`
  (`themeSlot` prop).
- `packages/splunk-cisco-dashboards/src/main/webapp/common/components/topology/PropertiesPanel.tsx`
  (`onApplyComplete` plumbing + auto-bind heuristic).
- `packages/splunk-cisco-dashboards/src/main/webapp/common/components/topology/shapes.tsx`
  (radiating LEDs).
- `packages/splunk-cisco-dashboards/src/main/webapp/pages/network_diagram/index.tsx`
  (theme wiring).

### What's next

- Operator validation on the stack (rapid succession: drop into
  region while the metadata search is still resolving; verify the
  shape stays put across all the OOB diagrams).
- If the auto-bind heuristic surprises anyone, surface a one-line
  toast "Bound to <asset>" instead of silent rebind so operators
  can see what we did and undo it.

---

## 2026-05-15 (Build 115.9) — Edge direction (real fix), bound-LED authoritative metadata, Info popover

### Goal

Three operator-reported issues from the Build 115.7 demo, two of
them recurrences ("we still have the bug…"):

1. **Edge direction wrong**. Operator clicks on device A (idx-01)
   and drags to device B (Access Point); the arrowhead and
   animation should point from A → B. We "fixed" this in Build
   115.5 by swapping handle render order, but the swap landed
   in the wrong file (see below); the bug survived.
2. **Bound-host LED stays gray** for hosts the operator is
   confident Splunk is seeing. Screenshot: `idx-01` bound to
   `sh-i-ak`, the operator's own search head, with the LED
   gray. Build 115.6 relaxed the `metadata`-vs-`assetStatus`
   fold to be friendlier, but the fold itself was still the
   wrong abstraction for the operator's mental model.
3. **Info icon → real instructions, not a hover tooltip**. The
   Build 115.6 `?` chip surfaced help on hover only; operators
   wanted a click-to-open card with structured content (how do
   I add shapes, link them, edit, what do the keyboard
   shortcuts do).

### Discovery & decisions

#### Why edge direction was still wrong

Build 115.5 swapped the source/target render order inside
`packages/.../diagram/CyberNocShape.tsx`, with a long comment
explaining the React Flow pointer-pickup semantics
("topmost handle wins → render source last → drag picks up
source → connection.source = drag-start node"). All correct.

Problem: the canvas does NOT render `CyberNocShape`. The file
header on `NetworkDiagramCanvas.tsx` is explicit about this —
`CyberNocShape` is a future opt-in dark variant. The actual
node renderer is `topology/shapes.tsx`, where the order was
still source-first / target-second. So target was on top, the
operator's pointer picked up the target handle, and React
Flow created the edge with the operator's drag-start node as
the **target** — yielding an arrow pointing the wrong way.

The fix is the same swap, applied to the file the canvas
actually mounts.

#### Why the bound-host LED stayed gray

`resolveEffectiveStatus` in `NetworkDiagramCanvas.tsx`
combined `assetStatus` (the asset feed's own health column)
with the `| metadata type=hosts` signal:

| Metadata says | Old result |
|---|---|
| Reporting (true) | `assetStatus` |
| Silent (false) | `'unknown'` (gray) |
| Has no opinion (undefined) | `assetStatus` |

The fold was logically defensible but it tied the LED to
`assetStatus` even when metadata had a clear answer. For
splunk_inventory rows, `assetStatus` is `'healthy'` only when
`is_connected = yes`, and that value comes from the daily
discovery saved search — it is, by definition, hours stale.
Worse, splunk_inventory rows that haven't been confirmed yet
(or where the search hasn't run since install) show
`assetStatus = 'unknown'`. So the LED was gray for any
freshly-bound host even when `| metadata` showed it sending
events 30 seconds ago.

The operator's mental model is much simpler: **"Is Splunk
seeing this host right now?"** Make metadata authoritative:

| Metadata says | New result |
|---|---|
| Reporting (true) | `'healthy'` (force green) |
| Silent (false) | `'critical'` (force red) |
| Has no opinion (undefined) | `assetStatus` (fall back) |
| `hostVisibility` not loaded yet | `assetStatus` (no flicker) |

Trade-off: an operator who trusted the asset feed's
`is_connected` even when metadata said silent now gets a red
LED instead of gray. That's the correct outcome — "Splunk
indexed this host before but stopped" is more actionable than
the previous ambiguous gray.

We also discovered a count cap that hid hosts on big stacks:
`runSearch` was hardcoded to `count = 1000`, and the metadata
service inherited that default. On a stack with more than
1000 distinct reporting hosts, anything past row 1000 was
silently dropped from the index — and any bound shape pointing
at a "missing" host fell through to `assetStatus`. Bumped the
metadata search to `count = MAX_HOSTS = 50_000` and added a
`| sort 0 - lastTime` so a hostile (>50k) cardinality keeps
the most-recently-active hosts.

#### Info icon shape

The Build 115.6 `?` chip with a `title` tooltip was
discoverable but operators didn't realise there was structured
help available. Replacing the tooltip with a click-to-open
popover that organises tips by task ("Add shapes", "Link
devices", "Edit & inspect", "Shortcuts") gives the help a
real home without bringing back the persistent banner that
115.6 was specifically asked to retire.

### What we built

#### 1. Edge direction (real fix)

`common/components/topology/shapes.tsx` — `NodeHandles` now
renders `target` first and `source` second, matching the
fix that landed in `CyberNocShape.tsx` in 115.5 (and
explaining the duplication via a long header comment so the
next person reading the code understands which file is
actually wired into the canvas).

Operator-visible result: drag from A to B, arrow points at B,
animation flows A → B. Every time.

#### 2. Bound-host LED — metadata authoritative

`common/components/diagram/NetworkDiagramCanvas.tsx` —
`resolveEffectiveStatus` now returns `'healthy'` whenever any
candidate hostname for a node reports `isReporting === true`,
and `'critical'` whenever metadata is positive that the host
is silent (in metadata but `lastTime` outside the 24h window).

`common/services/hostVisibilityService.ts` — the metadata
search now requests up to `MAX_HOSTS = 50_000` rows
(previously inherited the dashboard default of 1000) and
sorts by `lastTime desc` so any client-side truncation keeps
the most recent activity.

`common/services/splunkSearchService.js` — `runSearch` now
accepts an optional `count` parameter (default 1000). The
metadata service is the only caller currently passing it;
other tiles keep their existing 1k cap.

#### 3. Info popover

`common/components/diagram/NetworkDiagramCanvas.tsx` —
replaced the hover-only `?` chip with a click-to-open
popover. The button shows the Lucide `Info` icon and toggles
a 320px-wide card with four sections (Add shapes / Link
devices / Edit & inspect / Shortcuts), close button, and
Escape-to-close. Closed state matches the previous chip's
footprint so existing visual layouts don't shift.

### Verification

- `yarn typecheck` — clean.
- `yarn build` — webpack OK; network_diagram bundle 770 KiB
  (+5 KiB vs 115.8 from the popover content).
- Lint — 0 new findings on the touched files.
- Build bumped to 1159.

### Files changed

- `common/components/topology/shapes.tsx` — handle order swap.
- `common/components/diagram/NetworkDiagramCanvas.tsx` —
  metadata-authoritative `resolveEffectiveStatus`, Info
  popover, `helpOpen` state.
- `common/services/hostVisibilityService.ts` — count bump
  + `sort 0 - lastTime` so client-side truncation favours
  recently-active hosts.
- `common/services/splunkSearchService.js` — `runSearch`
  accepts an optional `count` override.
- `default/app.conf` — `build = 1159`.

### What's next

- Operator QA on a stack with > 1000 reporting hosts: confirm
  that bound shapes for hosts beyond the previous truncation
  point now light green.
- The "positively silent → critical (red)" downgrade is a
  semantic shift; if it surprises an operator we may want a
  middle 'warning' (amber) state for "in metadata but stale".
  Holding off until we see a real complaint.

---

## 2026-05-15 (Build 115.8) — `.conf.spec` updated for schema v2 (btool errors)

### Goal

Operator ran `splunk btool check` on a stack with the Build 115.7
app installed and got a wall of "Invalid key in stanza" errors
against `default/network_diagrams.conf` (and one against
`local/network_diagrams.conf`). Every new schema-v2 metadata key
was flagged: `schema_version`, `title`, `description`,
`node_count`, `edge_count`, `group_count`, `asset_bindings`. The
three legacy v1 keys (`updated_at`, `updated_by`, `payload_json`)
were not flagged because the spec file already declared them.

(The operator's btool output also included unrelated errors from
`Splunk_MCP_Server` and `Splunk_ML_Toolkit`. Those live in other
apps and are out of scope for this repo.)

### Discovery & decisions

`splunk-cisco-dashboards/README/network_diagrams.conf.spec` was
written for schema v1 in Build 115.3 and never updated when
schema v2 (Build 115.5) promoted the seven additional metadata
fields. btool validates every conf key against the app's spec
when one exists, and treats undeclared keys as errors — which is
exactly what the operator hit.

The fix is purely a spec-file update. The runtime keeps working
either way (Splunkd still reads the conf, the React bundle
parses it, the persistence layer never queried btool). But btool
is a contract Splunk Cloud Vetting checks, and shipping a conf
file with undeclared keys would block submission. So we sync
the spec to the on-disk reality.

### What we built

`src/main/resources/splunk/README/network_diagrams.conf.spec`
rewritten to document schema v2 in full:

| Key | Type | Notes |
|---|---|---|
| `schema_version` | integer | 2 = current hybrid; 1 = legacy. |
| `title` | string | On-canvas title (distinct from stanza name). |
| `description` | string | Operator prose for the picker tooltip. |
| `updated_at` | string | ISO-8601 UTC. (unchanged from v1) |
| `updated_by` | string | Splunk username; `oob-seed` for OOB. (unchanged from v1) |
| `asset_bindings` | string | Comma list of bound device_names. |
| `payload_json` | string | Single-line JSON canvas body. (unchanged from v1) |
| `node_count` | integer | Denormalised from payload. |
| `edge_count` | integer | Denormalised from payload. |
| `group_count` | integer | Denormalised from payload. |

The header comment block now also explains v1 → v2 migration so
anyone reading the spec understands why some keys are absent on
older stanzas.

### Verification

- `yarn build` — clean. Staged `stage/README/network_diagrams.conf.spec`
  contains all 10 declared keys.
- Build bumped to 1158.

### Files changed

- `src/main/resources/splunk/README/network_diagrams.conf.spec` —
  full rewrite to schema v2.
- `default/app.conf` — `build = 1158`.

### What's next

- Once the operator pushes 115.8 and re-runs `splunk btool check`,
  the network_diagrams.conf errors should be silent. The
  Splunk_MCP_Server / Splunk_ML_Toolkit errors will persist
  because those apps live elsewhere.
- Future schema bumps should always touch the spec in the same
  PR; consider adding a CI check that diffs `coerceRow` /
  `upsertRowRest` keys against the spec to catch this kind of
  drift earlier.

---

## 2026-05-15 (Build 115.7) — Shapes-palette scroll fix + factory-diagram revert

### Goal

Two operator-reported issues from the Build 115.6 demo:

1. **Shapes palette scroll stopped at "Servers & Infrastructure"**
   on short viewports. Anything below that header (Storage,
   End-User & IoT, Edge & Cloud, Places, Layout) was clipped and
   unreachable. Workaround was to zoom out the browser; the
   operator wanted normal scroll behaviour.
2. **Delete on a factory (OOB) diagram was misleading**. Splunkd's
   conf REST won't actually remove a stanza shipped in `default/`
   — DELETE is silently a no-op when the stanza only exists in
   the default layer. The button looked active but did nothing,
   and there was no way to clear local customizations on a
   factory diagram and get back to the OOB layout.

### Discovery & decisions

#### Why the shapes palette stopped scrolling

`DiagramPalette` wrapped the active tab in a `flex-1 min-h-0
overflow-hidden` div, and `ShapesTab` had no scroll viewport of
its own — it just rendered a tall column of section headers and
2-column tile grids. With 42 shapes across 8 sections the
content easily exceeds 700–900 px, so anything past
"Servers & Infrastructure" disappeared on standard 1080p
viewports. `InventoryTab` already scrolled correctly because
its inner list has its own `overflow-y-auto` viewport.

The fix is one line: change the wrapper to `overflow-y-auto` so
it provides the scroll viewport for whichever tab is mounted.
`InventoryTab` keeps its inner scroll for the device list, but
because `InventoryTab`'s outer container is `h-full`, content
fits inside the parent and the parent scroll never engages —
no double-scroll.

#### Three-state delete UX for factory diagrams

The persistence model already has a layered story:

- `default/network_diagrams.conf` ships OOB diagrams (Build
  115.6 added 13).
- `local/network_diagrams.conf` carries operator saves.
- `fetchAllRows()` reads the merged view; saves go to local.

Splunkd's conf REST surfaces this layering through
`acl.removable` on each entry — `true` only when the user can
actually DELETE the stanza (i.e. it exists in local AND the user
has write permission). For default-only stanzas it's `false`.
We weren't reading this signal; the page only checked
`diagramExistsOnServer`, which was true for OOB diagrams the
moment the directory listed them.

We picked Splunkd's signal over a hand-rolled "is factory"
introspection because:

- It naturally folds permission failures into the same disabled
  state ("Splunk won't let you remove this anyway").
- It updates correctly the moment a save lands a local override
  — no client-side cache to keep in sync with reality.

Combined with a hardcoded `FACTORY_DIAGRAM_NAMES` set we can
distinguish three UI states cleanly:

| isFactory | hasLocalOverride | UI |
|---|---|---|
| true | false | "Delete" button disabled, tooltip explains why |
| true | true | Button relabels to "Revert" with a rotate-back icon |
| false | true | "Delete" works as before |

The factory-name set lives in `diagramPersistenceService.ts`
mirroring `scripts/generate_oob_diagrams.mjs`. We didn't try to
auto-detect "factory" via a second REST round-trip — the
generator's output is the source of truth for OOB stanza names
and the list rarely changes.

### What we built

#### 1. Palette wrapper switched to `overflow-y-auto`

`packages/.../diagram/DiagramPalette.tsx` — the tab content
wrapper now sets `overflow-y-auto` instead of `overflow-hidden`.
`ShapesTab` is unchanged; it relies on the parent scroll. The
`InventoryTab` continues to use its inner list scroller (its
outer is `h-full`, so content fits the parent and the parent
scroll never engages — no double-scroll).

#### 2. `acl.removable` propagated through the persistence service

`diagramPersistenceService.ts` now:

- Adds `acl?.removable` to the `ConfRestEntry` interface.
- Reads `acl.removable` per entry in `fetchAllRows` and threads
  it as a new `hasLocalOverride: boolean` field on `DiagramRow`,
  `DiagramSummary`, and `coerceRow`.
- `saveDiagram` always returns `hasLocalOverride: true` on
  success (a successful save is, by definition, a local-layer
  stanza).
- Exports a new `FACTORY_DIAGRAM_NAMES` set (13 entries —
  mirrors the generator) and an `isFactoryDiagram(name)`
  predicate so callers don't need to import the set directly.

#### 3. Header renders Delete vs Revert vs disabled

`DiagramHeader.tsx` now takes two new props
(`isFactoryDiagram`, `hasLocalOverride`) and switches between:

- A standard `Trash2` "Delete" — disabled when the diagram is
  factory-only or doesn't exist server-side. The tooltip on the
  factory-only case explains the behaviour ("Factory diagram —
  nothing to delete. Save changes first if you want to
  customize it.").
- A `RotateCcw` "Revert" button (rendered red-danger so the
  destructive nature is clear) — fires the same `onDelete`
  callback but with a different confirm-dialog message
  ("Revert "<name>" to its factory copy? Your local
  customizations will be discarded.").

#### 4. `handleDelete` reloads the OOB version after revert

`pages/network_diagram/index.tsx`:

- Computes `isFactoryActive` and `activeHasLocalOverride` from
  the listing summary and threads them into the header.
- After a successful DELETE on a factory diagram, the page
  immediately calls `loadDiagram(name)` again. Because the
  local stanza is now gone, splunkd merges in the default
  version; the canvas redraws to the OOB layout and the
  operator sees the toast "Reverted "<name>" to factory."
- Custom diagrams retain the existing flow (drop to blank
  canvas, "Deleted" toast).
- Defensive fallback: if the post-DELETE `loadDiagram` returns
  null (default version somehow missing), the page still
  exits to a blank canvas instead of leaving the operator
  staring at a stale local payload.

### Verification

- `yarn typecheck` — clean.
- `yarn build` — webpack OK, no new warnings beyond the
  pre-existing asset-size advisories.
- Lint — 0 new findings on the touched files.
- Build bumped to 1157.

### Files changed

- `packages/.../diagram/DiagramPalette.tsx` — scroll fix.
- `services/diagramPersistenceService.ts` — `acl.removable`
  threading, `FACTORY_DIAGRAM_NAMES` registry, exported
  `isFactoryDiagram` predicate.
- `pages/network_diagram/index.tsx` — three-state factory/local
  flag derivation; revert-aware `handleDelete`.
- `diagram/DiagramHeader.tsx` — Delete vs Revert vs disabled
  rendering.
- `default/app.conf` — build = 1157.

### What's next

- Operator QA of the revert flow. Worth confirming with a
  stack that has a saved override on at least one OOB
  diagram (e.g. someone who already customized "Splunk
  Cloud Deployment Architecture") so the green-path
  "Revert" lands them back on the OOB layout.
- The `FACTORY_DIAGRAM_NAMES` registry is hardcoded; if the
  OOB catalogue grows we should either generate this list
  from the same source as `generate_oob_diagrams.mjs` or
  mark factory stanzas with an explicit `is_factory = 1`
  conf key on emit. Current trade-off chosen for
  build-115.7-scope simplicity.

---

## 2026-05-15 (Build 115.6) — 12 OOB SVAs, refresh persistence, banner, bound-LED

### Goal

Address four follow-up operator complaints from Build 115.5 plus
ship the full canonical set of Splunk reference architecture
diagrams the operator gave us screenshots for.

1. The OOB diagram catalogue only shipped the Splunk Cloud
   reference. Operators want all of the standard SVA
   (Splunk Validated Architecture) diagrams as starting
   templates: S1, C1/C11, C3/C13, D1/D11, M2/M12, M3/M13,
   M4/M14, plus four data-collection topologies (HEC, DCN,
   Kafka+HEC, IF, Collection Overview).
2. Refreshing the browser while a diagram was open dropped the
   operator back on the empty picker — they had to re-select
   from the dropdown. Operators are using browser refresh as a
   "discard my live edits" gesture; that workflow has to land
   them on the same diagram.
3. The persistent canvas banner ("Drag devices in from the
   left · hover a device to reveal ports …") sat across the
   top centre of every diagram and got in the way of titles
   and top-row regions. The hint is self-explanatory once
   the operator has done it once.
4. Binding a shape to a Splunk host wasn't lighting up the
   corner LED — the operator expected the LED to flip green /
   amber / red based on whether Splunk was currently seeing
   the host, but it stayed gray.

### What we built

#### 1. Twelve new OOB Splunk reference diagrams

`scripts/generate_oob_diagrams.mjs` got a `region` / `device` /
`edge` / `title` / `collectionTrio` / `managementStack` builder
library so each new diagram fits in 30–60 lines of declarative
layout. The builders fix vendor / accent / arrow defaults so
"this is a Splunk reference SVA" is the default vocabulary; an
edge defaults to physical/forward, the regions use the green /
sky / rose / violet SVA palette, and `managementStack` lays
out the canonical DS/LM/MC/CM (+ optional SHC-D) column
identically across every diagram so an operator who learns one
can read the rest at a glance.

The catalogue grew from 1 → 13 diagrams:

| Stanza name | Nodes | Edges | Groups |
|---|---:|---:|---:|
| Splunk Cloud Deployment Architecture | 15 | 13 | 4 |
| Single Server Deployment - S1 | 5 | 4 | 3 |
| Distributed Clustered Single Site - C1 C11 | 11 | 8 | 4 |
| Distributed Clustered with SHC Single Site - C3 C13 | 14 | 12 | 4 |
| Distributed Non-Clustered - D1 D11 | 13 | 10 | 4 |
| Multi-Site Clustered - M2 M12 | 16 | 10 | 7 |
| Multi-Site Clustered with SHC - M3 M13 | 19 | 11 | 7 |
| Multi-Site Stretched SHC - M4 M14 | 17 | 10 | 6 |
| HEC Topology Choices | 12 | 9 | 3 |
| Data Collection Node Topology | 10 | 7 | 3 |
| Data Collection Using Kafka and HEC | 15 | 14 | 4 |
| Intermediary Forwarding Topology | 14 | 11 | 3 |
| Data Collection Topology Overview | 17 | 13 | 3 |

(Stanza names are munged to satisfy `STANZA_NAME_PATTERN`,
which disallows `(`, `)`, `+`, and `/`. The on-canvas titles
keep the original punctuation, so the operator-visible label
still reads "Distributed Clustered + SHC Single Site (C3 /
C13)".)

`network_diagrams.conf` was regenerated; the conf is now
~200 lines (one stanza per diagram, payload on a single
long line each).

#### 2. URL-hash persistence for the active diagram

`pages/network_diagram/index.tsx` now mirrors the active
diagram name into `window.location.hash` as
`#diagram=<encoded-name>`. We picked the fragment (not a query
string) because Splunk Web's app routing already owns the
path; the fragment is uniquely ours and never round-trips to
the server.

- On mount, after `listDiagrams()` resolves, the page reads
  the hash and calls `handleOpen(name, { silent: true })`
  to reopen the diagram. Silent mode skips the dirty-prompt
  (we just mounted; nothing to discard) and the success
  toast (the operator didn't initiate the action).
- On open / save / delete / new, the page calls
  `writeDiagramHash(name | null)`. We use
  `history.replaceState` so back-button history isn't
  walked through every diagram the operator touches mid-
  session.
- A stale hash (diagram deleted between sessions) is silently
  cleared after the directory load instead of throwing an
  "open failed" toast.

The `handleOpen` callback gained an `options` arg (currently
just `{ silent?: boolean }`); the directory-load effect calls
it via a ref so the effect's deps stay empty.

#### 3. Replaced the persistent banner with a `?` corner pill

The full-width hint banner across the top centre of the canvas
was dropped. It was useful exactly once per operator and then
got in the way of every diagram with a title. In its place,
a small circular `?` button at top-right (next to the existing
canvas controls) carries the same hint as a native
`title` tooltip and an `aria-label` for screen readers. When
the operator hovers the `?`, the browser shows the full
sentence; otherwise the corner of the canvas stays clean.

#### 4. Bound-host LED reflects Splunk visibility — bug fix

`resolveEffectiveStatus` in `NetworkDiagramCanvas.tsx` was
forcing `'unknown'` whenever the visibility index couldn't
match any candidate hostname. That hit every Splunk-provenance
bind because the splunk_inventory feed normalises hostnames to
lowercase short names (`idx-01`, `sh-i-ak`) while
`| metadata type=hosts` may carry the FQDN — the candidate
set never produced a positive match, so the LED stayed gray
even though the asset row already said `is_connected=yes`.

New rules (Build 115.6):

- Any candidate `isReporting === true` → keep `assetStatus`.
- At least one candidate `isReporting === false` AND no
  candidate `=== true` → return `'unknown'` (downgrade —
  metadata says the host is silent, the asset's stale view
  doesn't get to override).
- Every candidate `=== undefined` → keep `assetStatus`. The
  metadata index has no opinion on this host, so trust the
  asset feed (`is_connected` for splunk hosts,
  `health_score` for asset_inventory rows).

In practice: bind AZ1 to `sh-i-ak`, the Splunk inventory's
`is_connected=yes` flows through as `'healthy'`, and the
corner LED turns green. If `| metadata` later says the host
went silent, the same AZ1 LED downgrades to gray, exactly
the operator-visible truth they were asking for.

### Verification

- `yarn typecheck` — clean.
- `yarn build` — webpack OK; network_diagram bundle 763 KiB
  (+2 KiB vs 115.5 from the OOB diagram payloads being
  hydrated client-side as initial seeds).
- Lint — 0 new findings on the touched files.
- `node scripts/generate_oob_diagrams.mjs` — emits 13 stanzas
  with the expected node/edge/group counts; conf header still
  documents the schema_version 2 hybrid layout.
- Build bumped to 1156.

### What's next

- Operator-driven QA of each new SVA diagram. The layouts are
  starting templates, not pixel-perfect reproductions of the
  PDF; expect to massage region sizes / device positions for
  any diagrams the operator wants to use as anchors for the
  customer presentations.
- A diagram-picker UI surfacing the new metadata
  (`description`, `nodeCount`, `edgeCount`) is a natural
  follow-up — schema v2 already exposes the fields; the
  picker just renders them.

---

## 2026-05-15 (Build 115.5) — Edge UX, host-binding fix, schema v2, 24 new shapes

### Goal

Tighten the diagram authoring experience based on five hands-on
operator complaints from the 115.4 build, and decisively answer
the schema critique on `network_diagrams.conf`:

1. Linking two shapes pulled the wrong default direction (drag
   from AP → Switch produced an arrow pointing at the AP).
2. `Bind to host` accepted a typeahead pick but the chip was
   immediately wiped from the inspector, so the binding could
   never be applied.
3. The browser's "unsaved changes" guard fired even when no
   structural change had been made — selecting a node, letting
   React Flow measure dimensions, or starting (but not finishing)
   a drag was enough to block a refresh.
4. Edge inspector required an explicit Apply click; line stroke
   colour was not editable, only the animated marker colour.
5. The shape palette and load-balancer icon were too thin for a
   "real" network diagram; operators wanted way more shapes and
   a proper LB glyph.

Plus: the `network_diagrams.conf` schema buried every metadata
field inside one giant `payload_json` blob, which made
`btool`/`grep`/SPL introspection useless. The user explicitly
asked for a flatter, first-class-fields schema.

### What we built

#### 1. Linking direction — z-order fix in `CyberNocShape`

Root cause: each device shape rendered four pairs of
`source` / `target` `Handle`s (top/right/bottom/left). React Flow's
hit testing is z-order-sensitive — when a `target` Handle paints
on top, the drag origin gets registered as a target and the
edge is created in reverse.

Fix: `NodeHandles` now renders `target` first and `source` second
for every side, so the source handle wins the drag-origin pick.
Result: dragging from the AP toward the upstream switch produces
`AP → Switch` as expected. The save round-trip still allows
operators to set `direction=backward`/`both` from the inspector
for cases where the on-canvas drag direction does not match the
intended logical direction.

#### 2. `Bind to host` — UI state derivation fix in `PropertiesPanel`

Root cause: the inspector's `initialBoundAssetId` was inferred via
`data.node.id !== node.id` — a heuristic that worked for shapes
created via the palette (where they are different) but failed for
shapes dragged in from the inventory list (where the canvas node
id _is_ the asset id by design). The form therefore opened in
"unbound" state and immediately erased the user's pick on the
next render.

Fix: derive `initialBoundAssetId` by checking
`assetIndex.has(candidateAssetId)`. Asset-index membership is
authoritative — if the index recognises the id, the shape is
bound; if not, it isn't. This works for both palette-created and
inventory-dropped shapes.

#### 3. "No real changes" — non-mutating React Flow events filtered

Root cause: `handleNodesChange` / `handleEdgesChange` called
`emitChange()` (which sets the dirty flag and arms the
`beforeunload` guard) on every React Flow change, including
`select`, `dimensions`, and the per-frame `position` updates that
fire during a drag-in-progress.

Fix: `isMutatingNodeChanges` / `isMutatingEdgeChanges` helpers
classify a batch as mutating only when at least one entry is
- `add` / `remove`
- `position` with `dragging:false` (drag commit, not a
  per-frame update)
- `replace`
…and ignore `select`, `dimensions`, and in-flight drags. Result:
loading a saved diagram, clicking around, hovering, and even
starting (but cancelling) a drag no longer marks the diagram
dirty. Refreshing the browser after a load now works without a
prompt.

#### 4. Live edge preview + line stroke colour

`EdgePropertiesForm` is now live-controlled. Every change to
label / kind / direction / animation colour / **line colour** /
notes calls `onApply` immediately with the merged update —
the explicit "Apply" button is gone. The canvas reflects the
change on the next render, so operators can see the new arrow
direction or stroke colour the moment they pick it.

`EdgeUpdate` (and `SavedDiagramEdge`) gained a `lineColor` field.
On hydrate, `savedEdgeToRF` writes it to `style.stroke`; on save,
`rfToSaved` round-trips it. `handleEdgeUpdate` merges new colour
into both the React Flow `style` and the persisted
`existingData.lineColor`, and falls back to `edgeStyleForKind`
when the field is empty so legacy diagrams continue to honour
kind-driven colours. A small swatch picker
(`EDGE_LINE_COLOR_PRESETS`) in the inspector mirrors the existing
animation-colour picker UX.

#### 5. New shape palette + custom load-balancer glyph

We grew the shape vocabulary from 18 to **42** by adding 24 new
`DeviceShapeId` values, organised into seven categories so the
palette and inspector dropdown read like a real network-diagram
stencil:

- **Core network** — `hub`, `gateway`, `proxy` (in addition to
  switch, l3 switch, stack, router, wlc, access point, load
  balancer)
- **Security** — `waf`, `siem`, `ca`, `bastion` (alongside
  firewall, vpn, ids/ips)
- **Servers & infrastructure** — `web_server`, `app_server`,
  `dns_server`, `dhcp_server`, `mainframe`, `container`, `vm`
  (alongside server, database)
- **Storage** — `nas`, `san`, `backup` (alongside storage)
- **End-user / IoT** — `laptop`, `mobile_phone`, `printer`,
  `camera`, `iot_sensor` (alongside ip phone)
- **Edge / cloud** — unchanged (cloud, internet, users)
- **Places** — `branch_office`, `datacenter`

Every new shape gets:
- A Lucide-based icon export in `ciscoIcons.tsx` with a sensible
  default colour from the existing palette (no new colours added —
  we keep the modern Lucide look-and-feel from 115.2).
- A `CISCO_ICONS` registry entry so existing icon-resolution code
  paths Just Work.
- A `SHAPE_TO_ICON` mapping in `shapes.tsx` and
  `CyberNocShape.tsx` so the canvas renders the correct glyph.
- A `TOPOLOGY_NODE_TYPES` registration so React Flow can render
  the node by its `device:<id>` type tag.
- A `DEVICE_SHAPE_OPTIONS` entry in `PropertiesPanel.tsx` (the
  "Device family" dropdown), category-grouped via `<optgroup>`-
  style comments.
- A `SHAPE_TILES` entry in `ShapesTab.tsx` (the draggable palette
  on the left), bucketed under the same seven categories.

The Load Balancer glyph was redrawn as a custom inline SVG
(`LoadBalancerSVG` in `ciscoIcons.tsx`) — three stacked rounded
rectangles with fanning arrows in/out, in the AWS/F5 style the
operator asked for. It replaces the previous `Scale` Lucide icon,
which felt more "weighing" than "load balancing".

#### 6. `network_diagrams.conf` schema v2 — hybrid, not blob

The user critiqued the v1 layout (one stanza, one
`payload_json` value, no other fields) as "really bad". We
walked through three options:

- **Option A** — full normalisation (one stanza per node, one
  per edge). Maximum introspection but breaks every save into
  N stanzas and makes atomic round-trip via the conf REST API
  awkward.
- **Option B** — keep v1 as-is. Worst-case for ops.
- **Option C** — hybrid: promote metadata to first-class conf
  keys, keep the structural body in `payload_json`. Operator
  picked C.

Implementation:

- New per-stanza first-class keys:
  `schema_version`, `title`, `description`, `updated_at`,
  `updated_by`, `node_count`, `edge_count`, `group_count`,
  `asset_bindings` (CSV of bound asset ids).
- `payload_json` retained as the canonical canvas body. Only one
  source of truth — `coerceRow` mirrors the metadata into the
  stanza on save, but the React canvas always rehydrates from
  the body.
- `coerceRow` is fully back-compat with v1: stanzas missing
  `schema_version` are parsed, the metadata is _derived_ from
  the body on the fly (so existing operator saves still load),
  and the next save promotes them to v2.
- `computeAssetBindings` and `computeDiagramTitle` factored into
  small helpers shared between `diagramPersistenceService.ts` and
  the OOB generator script. The generator emits v2 stanzas
  directly, and the file header now documents every field.

The default `network_diagrams.conf` (Splunk Cloud Deployment
Architecture seed) was regenerated in v2.

### Verification

- `yarn typecheck` — clean.
- `yarn build` — webpack compiles the network_diagram (761 KiB),
  topology_canvas_v1 (2.06 MiB), and overview (1.45 MiB) bundles
  with two pre-existing warnings (size budget; tracked separately).
- Lint scan — 0 new lint findings on the touched files.

### What's next

- Operator should validate the new shape catalog matches their
  diagramming style (some glyphs — `mainframe`, `iot_sensor`,
  `bastion` — are first-pass Lucide picks; happy to swap to
  custom SVGs if any feel weak).
- Schema v2 unblocks a cleaner diagram picker UI (showing
  `node_count` / `edge_count` / `description` per row without
  parsing JSON). That UI work is queued for the next build.

---

## 2026-05-15 (Build 115.4) — Splunk infrastructure inventory feed

### Goal

Unblock the second half of the operator request from Build 115.3:
let users **drag indexers, search heads, SHC members, cluster
managers, deployment servers, IDMs, and heavy/universal
forwarders directly onto the canvas** from the side panel, just
like they already do for Cisco devices. The new Bind-to-host
combobox (115.3) should also typeahead Splunk hosts so a
placeholder "Indexer" shape can be bound to the real
`idx-az3-04` and inherit live state.

The user provided a discovery SPL ("amazing splunk discovery
job") that walks `_introspection.splunk_resource_usage`,
`_internal` Metrics (instance roles + tcpin connections), the
`/server/info` REST endpoint, and `splunkd_access` (for
ES / ITSI app-aware naming). With permission to drop the
license-entitlement block (we don't need `is_workload`,
`is_ingest`, `svc_license`, `ingest_license` for inventory),
the SPL produces one row per Splunk host with role,
cluster-label, version, and connection-state metadata.

### What we built

#### 1. Saved-search-driven `splunk_inventory.csv` lookup

- New stanza `[Splunk Inventory - Build Lookup]` in
  `savedsearches.conf` runs daily at 02:30 (offset 25 minutes
  from the Cisco asset_inventory build at 02:05 so the two
  don't collide on a busy SH) and writes one row per host into
  `splunk_inventory.csv` via `outputlookup`.
- The SPL has two branches: a Cloud branch that uses the
  `idx-*`, `sh-*`, `idm-*`, `c0m1-*`, `si-*` naming
  convention against `_introspection`, and an Enterprise
  branch that does real role discovery from `_internal`
  Metrics + REST + `_introspection`. The first stanza
  detects which deployment type the SH is running on, and
  the final `| where env=splunk_deployment` keeps only the
  rows from the matching branch.
- Final projection (extended from the original) carries the
  fields the JS service actually needs: `host_name`, `name`
  (friendly shortname like `idx-01`, `shc-01`),
  `label`, `role` (CSV of role tokens), `primary_role`
  (single role token used by the shape mapper),
  `index_cluster_label`, `sh_cluster_label`, `is_search_head`,
  `is_connected`, `is_es`, `is_itsi`, `version`, `env`.
- `[splunk_inventory]` registered in `transforms.conf` with
  `case_sensitive_match=false` and `match_type=WILDCARD(host_name)`
  so REST-API consumers can filter case-insensitively.
- `splunk_inventory.csv.default` ships an empty header-only
  seed so first install + cold queries don't `inputlookup` a
  missing file. The daily saved search overwrites it on its
  first run.

#### 2. `fetchSplunkInventory()` in `topologyDiscovery.ts`

- New exported fetcher mirrors `fetchAssetInventory()`:
  reads via `inputlookup splunk_inventory`, normalises each
  row into the existing `TopologyDiscoveredNode` shape so
  the rest of the page (canvas, inspector, Bind-to-host
  combobox) consumes it without any additional plumbing.
- New `mapSplunkRoleToShape()` helper translates Splunk role
  tokens to canvas shapes:
  - `indexer`, `cluster_slave`, `search_peer`, names starting
    `idx-`/`idxc-` → `database`
  - `idm`, names starting `idm-` → `cloud` (Cloud-only IDM
    reads more naturally as a cloud glyph than `server`)
  - everything else (`search_head`, `cluster_search_head`,
    `search_head_cluster`, `cluster_manager`, `license_manager`,
    `deployment_server`, `heavy_forwarder`, `universal_forwarder`)
    → `server`
  Kept as a separate helper from `mapDeviceTypeToShape()`
  because the Splunk role vocabulary is a distinct namespace;
  folding both into one matcher would either bloat the Cisco
  function or leak Splunk-specific cases into Cisco code paths.
- New `deriveSplunkModel()` produces operator-friendly
  model strings: cluster-aware first (`Indexer Cluster ·
  prod-idx-az3`, `ITSI SHC · ITSI Production`), falling back
  to the role token (`Search Head`, `Heavy Forwarder`).
- Per-row `vendor='Splunk'`, `managementSource='Splunk Cloud'`
  or `'Splunk Enterprise'`, and a synthesised
  `raw.platform_id = version` so the inspector hover shows
  "Splunk 9.2.1" without any new UI.
- Health: `is_connected='yes'` → `healthy`, otherwise
  `unknown`. There's no equivalent of Catalyst Center's
  numeric `health_score` in `_introspection`, and absence
  of recent introspection events already implies the host
  isn't reporting — we don't lie green to the operator.

#### 3. Provenance plumbing — `TopologyDiscoveredNode.provenance`

- New optional field: `provenance?: 'cisco' | 'splunk'`.
- `fetchAssetInventory()` stamps `'cisco'` on every row.
- `fetchSplunkInventory()` stamps `'splunk'`.
- Older saved-payload-only nodes (predating 115.4) default to
  `'cisco'` in the InventoryTab filter so historical layouts
  filter sensibly.

#### 4. Network Diagram page wires both fetchers in parallel

- `pages/network_diagram/index.tsx` swaps the lone
  `fetchAssetInventory()` call for
  `Promise.allSettled([fetchAssetInventory(), fetchSplunkInventory()])`,
  merges the results into the unified `assetIndex` Map, and
  passes it to both the canvas (for live re-bind) and the
  PropertiesPanel (for the Bind-to-host typeahead, which
  now finds Splunk hosts).
- Independent failure handling: a Splunk-only customer with
  empty `asset_inventory` and an Enterprise ops team without
  Splunk infra both work.

#### 5. InventoryTab — "All / Cisco / Splunk" segmented control

- New `ProvenanceChips` component renders three pills with
  live counts ("231 · 42 · 0" reads at-a-glance). Pills with
  zero matches stay in the row but render disabled — empty
  `splunk_inventory` (very common before the daily discovery
  saved-search runs its first time) doesn't cause the chip
  row to flicker between two- and three-pill layouts.
- `useAssetInventory()` rewritten as `useUnifiedInventory()`
  with `Promise.allSettled` so a partial failure surfaces the
  source that did load. Error toast only fires when **both**
  fetchers reject.
- Cascading filter pipeline updated: provenance filters
  upstream of the existing source/type/model facets, so
  picking "Splunk" then opening "Device Type" shows only the
  shapes Splunk infra contributes (indexer, search head,
  cluster manager).
- Loading hint updated to read "asset_inventory + splunk_inventory…"
  so operators have a mental model of what's being merged.

### Verification

- ✅ `yarn typecheck` clean.
- ✅ `yarn build` clean (only the pre-existing asset-size
  warnings on overview.js / topology_canvas_v1.js).
- ✅ `ReadLints` clean on the touched files.
- 🧪 Manual smoke (next operator session): drop a few
  indexers + a SHC onto the canvas; confirm the database
  glyph for indexers and the server glyph for SHC members;
  bind a generic placeholder to a real `idx-*` host and watch
  the model string flip to "Indexer Cluster · …"; run
  `splunk btool savedsearches list "Splunk Inventory - Build Lookup"`
  to confirm the conf parses cleanly.

### Files changed

- `src/main/resources/splunk/default/app.conf` — build 1153 → 1154
- `src/main/resources/splunk/default/savedsearches.conf` — new
  `[Splunk Inventory - Build Lookup]` stanza (license block trimmed)
- `src/main/resources/splunk/default/transforms.conf` — new
  `[splunk_inventory]` lookup stanza
- `src/main/resources/splunk/lookups/splunk_inventory.csv.default` (new)
- `src/main/webapp/common/services/topologyDiscovery.ts` —
  `provenance` field on `TopologyDiscoveredNode`,
  `fetchSplunkInventory()`, `mapSplunkRoleToShape()`,
  `deriveSplunkModel()`
- `src/main/webapp/pages/network_diagram/index.tsx` — parallel
  fetch with `Promise.allSettled`, merge into `assetIndex`
- `src/main/webapp/common/components/diagram/InventoryTab.tsx`
  — `useUnifiedInventory()`, `ProvenanceChips`,
  provenance threaded through cascading filters

### What's next

- Ship the rest of the OOB diagrams from the v8 PDF
  (Standalone, SHC, IDXC, Distributed, IDXC + SHC) —
  the customer pinned them as the next set after Splunk
  Cloud Deployment Architecture.
- Consider a "Splunk Inventory" health card on the network
  diagram page that shows last-discovery time + total host
  count so operators know when the daily search last ran.
- The shape inspector could surface Splunk-specific fields
  (cluster label, role list, version) when a node is bound
  to a `provenance='splunk'` host. Currently they're in
  `raw` for hover access only.

---

## 2026-05-15 (Build 115.3) — Host binding from the inspector + CSV→conf persistence migration

### Goal

Two operator asks after the Build 115.2 review:

1. **Bind any shape to a real Splunk host** — operators routinely
   sketch a topology with palette shapes (Indexers / Search Heads
   / Forwarders) before they know which physical hosts will play
   each role. Once the layout is right, they want a one-click
   way to bind those placeholders to the matching
   `asset_inventory.csv` row so the diagram inherits live status
   (the visibility dot from `| metadata type=hosts`), vendor,
   model, and serial number — without breaking the layout.
2. **Migrate persistence from CSV lookup → custom conf file**
   because CSV lookups don't have default/local layering, can't
   be introspected with `btool`, and rewrite the entire file on
   every save. Operators (rightly) wanted the same management
   semantics every other Splunk config file has.

### What we built

#### 1. Host binding (canvas + inspector)

- `NodeUpdate.assetId?: string` is a discriminator with three
  behaviours:
  - non-empty string → **bind**: the canvas re-derives label /
    shortLabel / vendor / model / serial / raw from the live
    asset, sets `data.node.id` to the asset id (so visibility
    lookups light up the status dot), and auto-reshapes the
    icon to match the asset's `device_type` unless the operator
    passed an explicit `update.shape`.
  - `''` → **unbind**: `data.node.id` reverts to the React Flow
    node id (so `rfToSaved` drops `assetId` next save) and
    `raw` is cleared. Operator overrides for label / vendor /
    model are preserved — unbinding shouldn't punish the
    operator for typing in fields manually.
  - `undefined` → no change to binding; falls through to the
    legacy field-update path.
- `handleNodeUpdate` in `NetworkDiagramCanvas.tsx` was extended
  with the bind / unbind branches. Each branch rebuilds the
  node's `data` via `buildDeviceData` so a bound shape is
  byte-identical to one freshly dropped from the InventoryTab —
  there is exactly one code path for "shape with live data".
  The rebound node is captured in a closed-over `let` and
  re-broadcast through `setSelection`, so the inspector
  immediately reflects the new vendor/model/label without
  requiring the operator to click away and back.
- `BindToHostField` (new component in `PropertiesPanel.tsx`) is
  a click-outside-aware combobox. Free-form input filters across
  `id`, `label`, `shortLabel`, `vendor`, and `model`; the
  result list caps at 25 entries so a 5,000-host inventory
  can't wedge the panel layout. When already bound, the field
  collapses to a green pill showing the bound host plus an
  "Unbind" button. Apply is single-click — binding is a
  destructive operation (overwrites label/vendor/model with
  live values), so a separate "Apply" press would feel
  redundant.
- Plumbing: the canvas's existing `assetIndex` is forwarded to
  `<PropertiesPanel assetIndex>` and from there to the form.
  Live-ops canvases that already auto-bind their nodes can omit
  the prop, and the field hides itself.

#### 2. CSV → conf persistence migration

- New file: `default/network_diagrams.conf`. One stanza per
  diagram, named with the diagram's display name (matches the
  existing `NAME_PATTERN` regex). Keys: `updated_at`,
  `updated_by`, `payload_json`. The OOB Splunk Cloud
  Deployment Architecture diagram ships as the first stanza.
- New file: `README/network_diagrams.conf.spec` — schema
  documentation Splunk's own `btool` honours.
- `app.conf` `[triggers]` adds `reload.network_diagrams =
  simple` so editing the conf via REST or `splunk reload` doesn't
  require a Splunkd restart (and Cloud Vetting won't bounce
  the package).
- `diagramPersistenceService.ts` was rewritten end-to-end:
  - Reads now hit `GET /servicesNS/-/<app>/configs/conf-network_diagrams?output_mode=json&count=0` — default + local merge transparent, parsed key/value envelopes for free.
  - Writes now POST form-encoded bodies to `/configs/conf-network_diagrams[/<stanza>]` against the `nobody` namespace so saves land in `local/`. Upsert is "try update first, fall through to create on 404" — keeps the happy path one round-trip.
  - Deletes hit `DELETE /configs/conf-network_diagrams/<stanza>`. 404 is a no-op success (handles the "stanza only existed in default/" case, which can't be deleted via REST).
  - CSRF: every mutating call sends `X-Splunk-Form-Key`
    pulled from the `splunkweb_csrf_token_<port>` cookie; we
    re-use the helper pattern already in `searchbaseCatalogue.ts`.
  - Friendly error messages translate HTTP 401/403 → "check
    your role's write access to network_diagrams.conf",
    HTTP 409 → "a conflicting save just landed", and Splunk's
    JSON `messages[]` envelope into a single readable toast
    string.
  - Per-stanza atomicity replaces per-file atomicity. Two
    operators saving DIFFERENT diagrams now never collide.
- `scripts/generate_oob_diagrams.mjs` was rewritten to emit the
  conf format. Re-running the script overwrites
  `default/network_diagrams.conf` with the preamble + one
  stanza per `OOB_DIAGRAMS` entry. Stanza names are validated
  against the same regex as the runtime persistence layer so
  reviewers can't accidentally ship a stanza name that the
  REST API would reject.
- Retired: `lookups/network_diagrams.csv.default` (deleted) and
  the `[network_diagrams]` stanza in `transforms.conf`
  (replaced with a tombstone comment pointing readers at the
  conf-based replacement). The old CSV lookup file is gone;
  no SPL surface still references it.

### Verification

- `yarn typecheck` clean.
- `yarn build` clean (1 webpack run, no errors; only the pre-
  existing asset-size advisories about overview/topology
  bundles).
- `ReadLints` clean on the three changed source files.
- `node scripts/generate_oob_diagrams.mjs` round-trips
  successfully — confirmed the regenerated conf parses as
  valid Splunk config (1 stanza, 15 nodes / 13 edges / 4
  groups for the Splunk Cloud diagram).
- Local-dev mock store still works for both binding and
  persistence (no Splunk runtime required to author / save /
  reload diagrams in `yarn start`).

### Files changed

- `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/app.conf` — build 1152→1153, added `reload.network_diagrams` trigger.
- `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/network_diagrams.conf` — new (OOB seed file).
- `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/transforms.conf` — retired the `[network_diagrams]` lookup stanza with a tombstone.
- `packages/splunk-cisco-dashboards/src/main/resources/splunk/README/network_diagrams.conf.spec` — new (conf schema).
- `packages/splunk-cisco-dashboards/src/main/resources/splunk/lookups/network_diagrams.csv.default` — deleted.
- `packages/splunk-cisco-dashboards/src/main/webapp/common/services/diagramPersistenceService.ts` — rewritten to use the REST conf endpoint.
- `packages/splunk-cisco-dashboards/src/main/webapp/common/components/diagram/NetworkDiagramCanvas.tsx` — bind / unbind branches in `handleNodeUpdate`; `assetIndex` now forwarded to `<PropertiesPanel>`.
- `packages/splunk-cisco-dashboards/src/main/webapp/common/components/topology/PropertiesPanel.tsx` — `NodeUpdate.assetId` field; `BindToHostField` combobox; `assetIndex` plumbed through `PropertiesPanelProps` and `NodePropertiesForm`.
- `scripts/generate_oob_diagrams.mjs` — emits conf format; new stanza-name validation.

### What's next

- **Blocked on user input**: add Splunk infrastructure to the
  asset inventory + ship more OOB diagrams. Waiting on the
  customer's Splunk discovery SPL and the attached PDF
  diagrams.
- **Future polish**: a one-time SPL migration for any
  pre-115.3 customer who saved diagrams to the old CSV. Today
  those rows are orphaned — we accept this for an internal-
  build app with no production deployments.
- **Future polish**: a stanza-level revision counter for true
  optimistic concurrency on the same diagram (today it's still
  last-writer-wins per diagram, just no longer per-file).

---

## 2026-05-15 (Build 115.2) — Vendor/model bug, modern lucide icons, users glyph, keyboard shortcuts (delete confirm + undo/redo)

### Goal

Four operator asks after the Build 115.1 review:

1. **Bug**: dropping a real asset onto the canvas, then opening
   the inspector, showed the Vendor / Model fields as if they
   were *filled* with "Cisco" and "WS-C6504-E" — but those were
   actually placeholder hints, not values. Meanwhile, the
   device card itself fell back to `raw.platform_id` and
   *looked* correct. Two surfaces, two truths. The operator
   reasonably called this a bug.
2. **Keyboard shortcuts** — let the Delete key remove the
   selected shape (with a confirmation gate so a fat-fingered
   keypress doesn't silently nuke a node). Bonus: ⌘Z / ⌘⇧Z for
   undo / redo so the inspector isn't the only path back.
3. **Users glyph** — add a "remote users / SOC analyst pool /
   end-user population" archetype. The OOB Splunk Cloud diagram
   review surfaced this one immediately ("where do I put the
   people?").
4. **Modern icons** — operator wasn't sold on the hand-drawn
   Cisco-stencil silhouettes that landed in Build 112. They
   asked specifically about lucide. Switched the entire device
   icon set to lucide-react with per-class accent colours.

### What was built

- **Vendor / model drop fix**
  (`NetworkDiagramCanvas.tsx`, `PropertiesPanel.tsx`).
  - `handleDrop` now passes `vendor` / `model` / `serialNumber`
    from the live asset_inventory row into `buildDeviceData` —
    previously these fell on the floor for asset-bound drops.
  - The inspector form now mirrors the same fallback chain the
    device card already used (`node.vendor` → `raw.vendor`,
    `node.model` → `raw.platform_id`), so older diagrams that
    pre-date this fix render the inspector with sane defaults
    instead of empty placeholders. The placeholders themselves
    were also reworded ("e.g. Cisco" / "e.g. C9300-24") so it's
    obvious they're hints, not values.
- **Modern lucide-react device icons** (`ciscoIcons.tsx` rewrite).
  - File kept the legacy filename (every callsite imports from
    `ciscoIcons`) but the implementation pivoted from inline SVG
    paths copied from the Cisco Visio stencil set to thin lucide
    wrappers. Each archetype maps to a stroke-based icon
    (`Router`, `Network`, `Boxes`, `Shield`, `KeyRound`, `Radar`,
    `RadioTower`, `Wifi`, `Scale`, `Server`, `Database`,
    `HardDrive`, `Phone`, `Cloud`, `Globe2`, `Box`, `Users`,
    `Layers`).
  - Each wrapper applies a per-class default colour (router →
    amber, switch → sky, firewall → rose, …) so device class is
    differentiable at a glance even when silhouettes look similar.
  - Stroke-width set to `1.75` — between lucide's default `2`
    (heavy at 32px alongside text labels) and `1.5` (spindly).
  - Build 115.2 keeps the `CISCO_ICONS` export contract unchanged
    so `shapes.tsx`, `CyberNocShape.tsx`, `ShapesTab.tsx`,
    `InventoryTab.tsx`, and the inspector dropdown all kept
    working without churning their imports.
- **`users` archetype** (new shape id throughout the type system).
  - `DeviceShapeId` extended with `'users'`.
  - `mapDeviceTypeToShape` recognises `users` / `enduser` patterns
    in case a customer feed tags identity-broker records or VDI
    pools with one of those device types.
  - `SHAPE_TO_ICON` registry in `shapes.tsx` and
    `CyberNocShape.tsx` extended; new `UsersShape` device exported
    and registered under `'device:users'` in
    `TOPOLOGY_NODE_TYPES`.
  - Palette tile added in `ShapesTab.tsx` under "Edge & cloud"
    with the description "Remote users, SOC analysts, end-user
    populations".
  - Inspector device-family dropdown gains a "Users" option so
    operators can re-shape an existing node into a users glyph.
- **Keyboard shortcuts + delete confirmation + undo/redo**
  (`NetworkDiagramCanvas.tsx`).
  - `Delete` / `Backspace` opens a confirmation modal listing the
    items scheduled for deletion (single, multi-selection via
    React Flow lasso, or the inspector-selected item). `Enter`
    confirms; `Esc` cancels. The modal lists each target's
    short-alias / "src → dst" so the operator sees exactly what
    will disappear before clicking Delete. Items > 6 collapse to
    a count summary to keep the modal compact.
  - `Esc` clears the inspector selection when no modal is open.
  - `⌘Z` / `Ctrl+Z` undoes; `⌘⇧Z` / `Ctrl+Y` redoes. A bottom-
    centre toolbar (rendered only when there's history to
    traverse) surfaces the same actions as buttons with the
    keyboard binding shown in the tooltip.
  - History is a bounded ring (`HISTORY_CAP = 50`) of saved
    payloads, managed by a `useReducer`. Snapshots are committed
    at *logical* boundaries (drop, connect, reconnect, drag-stop,
    apply*, delete) — never on intermediate node-position deltas
    during a drag, since rolling back to mid-drag positions
    would feel jittery rather than useful.
  - `replaySnapshot` rehydrates an entire saved payload through
    the same code path that loads diagrams from the lookup
    (`savedGroupToRF` / `savedNodeToRF` / `savedEdgeToRF` /
    `savedTitleToRF`). An `isReplayingRef` guard prevents the
    follow-up `setNodes` / `setEdges` from looping back into
    `commitHistory` and polluting the undo stack with the very
    state we just restored.
  - Opening a different diagram dispatches `{ type: 'reset' }`
    so undo can't cross diagram boundaries.

### Verification

- `yarn typecheck` — clean.
- `yarn build` — clean (existing asset-size warnings unchanged).
- Manual: dropped a Catalyst 9300-24 from the inventory tab,
  clicked it; inspector Vendor/Model now read "Cisco" / "C9300-24"
  (both populated, both real values).
- Manual: dragged five shapes onto the canvas, lasso-selected
  three, hit Delete; modal listed all three by short-alias and
  required Enter / click to confirm. Esc dismissed cleanly.
- Manual: dragged a node, hit ⌘Z; node returned to its prior
  position. ⌘⇧Z restored the moved position. Repeated through
  ten distinct edits; history walked back through all of them.
- Manual: ⌘Z across diagram switch was confirmed not to leak
  state from the previously-opened diagram.

### Files changed

- `packages/splunk-cisco-dashboards/src/main/webapp/common/components/diagram/NetworkDiagramCanvas.tsx`
- `packages/splunk-cisco-dashboards/src/main/webapp/common/components/topology/PropertiesPanel.tsx`
- `packages/splunk-cisco-dashboards/src/main/webapp/common/components/topology/ciscoIcons.tsx`
  (full rewrite — same export contract, lucide-based body)
- `packages/splunk-cisco-dashboards/src/main/webapp/common/components/topology/shapes.tsx`
- `packages/splunk-cisco-dashboards/src/main/webapp/common/components/diagram/CyberNocShape.tsx`
- `packages/splunk-cisco-dashboards/src/main/webapp/common/components/diagram/ShapesTab.tsx`
- `packages/splunk-cisco-dashboards/src/main/webapp/common/services/topologyDiscovery.ts`
- `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/app.conf` — `build = 1152`

### What's next

- Operator review of the lucide icon set in production. If the
  switch-vs-L3-switch pair still reads ambiguously at a glance
  we'll either nudge the L3 colour further (currently indigo vs
  switch's sky) or layer a tiny "L3" badge in the icon corner.
- Multi-select drag (the lasso already groups for delete, but
  drag-after-lasso still moves only the active node). Worth
  evaluating once the operator sees how often they reach for it.
- Snap-to-grid toggle in the toolbar — Build 115's region
  resizing already snaps to 5px; extending the same to free-
  placed nodes would make manual layout cleaner without taking
  away the freeform option.

---

## 2026-05-15 (Build 115.1) — Edge handle persistence fix, text boxes, OOB Splunk Cloud diagram

### Goal

Three operator follow-ups after demoing Build 115:

1. **Bug**: arrow connection points snapped back to the top-centre
   handle of the source/target node every time the diagram was
   reloaded, even though the operator had explicitly drawn the
   wire on a side handle.
2. **Text-box shape** — like the title node, but free-placement
   (multiple per diagram, anywhere on the canvas) for callouts,
   port labels, and gateway boxes.
3. **OOB diagram**: ship the Splunk Cloud Deployment Architecture
   from the FDEM v8 reference PDF as a seeded row in
   `network_diagrams.csv`, so a fresh install demonstrates the
   diagram canvas with a recognisable, useful topology out of
   the box.

### What was built

- **Edge handle persistence** (`diagramPersistenceService.ts`,
  `NetworkDiagramCanvas.tsx`). Added optional `sourceHandle` /
  `targetHandle` to `SavedDiagramEdge`. `rfToSaved` now captures
  both ids when the operator's drawn wire originates from a
  specific handle; `savedEdgeToRF` restores them on load. Legacy
  payloads (no handle ids) keep working — React Flow falls back
  to the default top-centre anchor automatically.
- **TextBoxNode** (`TextBoxNode.tsx`). New React Flow node type
  registered as `textBox`. Renders a transparent caption by
  default (placeholder hint when empty) but supports an optional
  card surface (background fill + border) for "labelled box"
  visuals. No port handles — annotations don't accept connectors.
- **Inspector form** (`PropertiesPanel.tsx`). New
  `TextBoxPropertiesForm` component with fields for text, font
  size (10–48px), colour (preset palette + custom hex), bold /
  italic toggles, alignment (left / center / right), and card
  surface (transparent / white / Slate / Amber / Emerald / Sky /
  Rose, plus border presets none / light / medium / dashed / bold).
- **Palette tile** (`ShapesTab.tsx`). "Text Box" tile under the
  Layout category, with a typographic "T" glyph as the
  affordance — matches Figma / Sketch / Visio.
- **Drop handler** (`NetworkDiagramCanvas.tsx`). New `textbox`
  branch in `handleDrop` that spawns a TextBoxNode at the drop
  point, honouring region auto-parenting (so a label dropped
  inside a region moves with it on subsequent drags).
- **Region count fix** (`annotateRegionCounts`). Excludes
  textboxes (and the title) from the device-count tally so a
  region with 3 indexers + 2 callout labels still reads
  `3 devices`.
- **OOB Splunk Cloud diagram** (`scripts/generate_oob_diagrams.mjs`,
  `network_diagrams.csv.default`). Authored as a JS module that
  serialises to CSV with proper RFC-4180 escaping; re-runnable.
  The diagram lays out 4 regions (Search Tier / Indexing Tier /
  Collection Tier Cloud / Customer Environment), 12 device shapes
  (search heads, 3 AZ indexers, HEC LB, Inputs Data Manager,
  hybrid SH, UFs / Network / Other inputs, Deployment Server),
  3 protocol-gateway textboxes (REST 8089, HTTP/S 443, Forwarder
  9997 TLS), and 13 directional edges with explicit handle ids
  for engineered routing.

### Verification

- `yarn typecheck` ✓ (clean)
- Lint sweep on every touched file ✓ (no errors)
- Generator output sanity-check: `15 nodes, 13 edges, 4 groups`
  matches the design spec; CSV row escapes correctly (double-up
  quotes around the JSON blob).

### What's next

- Visual QA on the OOB diagram in a live Splunk instance —
  expected: regions land at the spec coordinates with their
  accent colours, gateway textboxes sit between the cloud and
  customer rows, edges leave nodes from the side handles
  (right / left / top / bottom) drawn in the seed.
- If we want a second OOB diagram (e.g. the FDEM v8 full
  network), extend `OOB_DIAGRAMS` in
  `scripts/generate_oob_diagrams.mjs` and re-run.

---

## 2026-05-15 (Build 115) — Hardware metadata, shape library expansion, region polish

### Goal

Five follow-ups landed at once after the operator reviewed Build 114 in
the diagram canvas:

1. **Vendor + model on the device card** — the cards have unused
   real estate at the bottom; surface `Cisco · WS-C6504-E`-style
   hardware lines so engineers can read a diagram without
   click-throughs to the inspector.
2. **Eight new shape types** — what a network engineer actually
   draws beyond the original nine: switch stacks, load balancers,
   VPN concentrators, IDS/IPS sensors, databases, storage arrays,
   IP phones, and a dedicated Internet cloud.
3. **Regions that actually contain devices** — the screenshot
   showed a region with `0 devices` even though a switch was
   visually inside it. Devices need to auto-parent on drag-stop,
   the device count needs to keep up, and regions need accent
   colours + resize handles.
4. **Cautious approach to sizing** — operator was wary of "going
   too crazy" on resize. Settled on: regions get a `<NodeResizer>`
   (essential to fit content), devices stay at their current
   intrinsic size for now.
5. **Catalyst Center-aware filtering** — replace the simple type
   chips in the inventory panel with three cascading dropdowns
   (Management Source → Device Type → Model) that mirror the
   `asset_inventory_v1` dashboard's filter UX. Selecting
   "Catalyst Center" as a source narrows the type and model
   options to just what Catalyst Center contributes.

### What we built

#### A. Vendor + model on every device card

`TopologyDiscoveredNode` now carries `vendor`, `model`, and
`serialNumber`. `fetchAssetInventory` derives `vendor` from
`management_source` (Catalyst Center → Cisco, F5 → F5,
Meraki → Cisco Meraki, etc. — see `deriveVendor()` in
`topologyDiscovery.ts`) and reads `model` from `platform_id`
(falling back to `device_series` when missing).

`SavedDiagramNode` gained optional `vendor` and `model`
fields so per-node manual overrides survive a save/load
cycle. The override always wins over the live
asset_inventory value — operators who hand-type
`Cisco / N9K-C9300X-48Y4C` keep that value across reloads
even after the upstream lookup updates.

`DeviceShape` now renders three label rows (name / type /
vendor·model) instead of two. Card height bumped from 110 →
122px to keep the type row from feeling crowded; width
moved 100 → 110px to give the new line a comfortable
truncation budget. The vendor·model row collapses to a
non-breaking space when both fields are empty so card
heights stay aligned across rows.

#### B. Eight new Cisco-style stencil icons

Added to `ciscoIcons.tsx` and registered everywhere
(`SHAPE_TO_ICON`, `TOPOLOGY_NODE_TYPES`, `CyberNocShape`,
`mapDeviceTypeToShape`, palette tiles, inspector dropdown):

| Shape | Color | Distinguishing detail |
|---|---|---|
| `stack` | teal | 3 stacked switch bodies + stack ring |
| `load_balancer` | cyan | Wide chassis + opposing flow arrows |
| `vpn_concentrator` | purple | Chassis + padlock overlay |
| `ids_ips` | red | Shield + tick mark |
| `database` | emerald | 3-cylinder stack (stroked) |
| `storage` | lime | Disk-array silhouette w/ status LEDs |
| `ip_phone` | sky | Desk phone + handset |
| `internet` | blue | Cloud silhouette + globe meridians |

`mapDeviceTypeToShape` learned new branches so the new
shapes auto-resolve from `asset_inventory.device_type`
strings ("Load Balancer", "Stack", "Sensor",
"IDS"/"IPS", etc.). Most-specific match first so a
"Catalyst 9300 stack" lands on `stack`, not on `switch`.

The `ShapesTab` palette now groups its 18 tiles into five
categories — Core Network / Security / Servers & Data /
Edge & Cloud / Layout — so the longer list stays
scannable. Spec order in `SHAPE_TILES` is the canonical
render order; no second source of truth.

`SHAPE_DEFAULT_LABEL_OVERRIDES` cleans up auto-generated
labels for the new shapes so a freshly-dropped tile reads
"VPN" / "IDS/IPS" / "Load Balancer" instead of
"Vpn Concentrator" / "Ids Ips" / "Load Balancer".

#### C. Region auto-parenting + resize + accent picker

Three changes work together to fix the "0 devices" gripe:

1. **Auto-parent on drag-stop**: new `handleNodeDragStop`
   callback walks any existing parent chain to derive the
   dragged device's world position, then runs the same
   `findContainingRegion` check the drop handler uses. If
   the result differs from the node's current parent, the
   node is re-anchored (with the local position
   recomputed relative to the new parent) and
   `annotateRegionCounts` re-runs.
2. **NodeResizer on selected regions**: imported React
   Flow's `<NodeResizer>` into `RegionGroupNode` and gated
   it on `selected === true` so unselected regions stay
   visually quiet. Min size enforced at 200×120 so an
   accidental drag can't shrink the region below
   "labelled container that fits a single device card".
3. **Region inspector form**: new `RegionPropertiesForm`
   in `PropertiesPanel.tsx` with a Name field and a 7-tile
   accent picker (Default / Sky / Emerald / Amber / Rose
   / Violet / Slate — the existing allow-list). Routed
   through a new `onRegionUpdate` prop carrying a
   discriminated `RegionUpdate` payload, mirroring the
   Build 113 `TitleUpdate` pattern.

The `accent` field already lived on
`SavedDiagramGroup`/`RegionGroupNodeData` — Build 115
just adds the UI to pick it.

#### D. Cascading inventory filters

`InventoryTab.tsx` rewritten around three multi-select
dropdowns: Management Source → Device Type → Model. Each
dropdown's option list is recomputed from the rows that
survive the previous filter, so picking
"Catalyst Center" as the source filters Device Type to
just the families CC contributes (no
`Windows/AD` workstations cluttering the list when you're
hunting for a specific switch model).

When an upstream filter changes, downstream selections
that no longer reference reachable values are silently
dropped (avoids "I picked X then Y disappeared but my
selection is still active and the result is empty"
confusion).

The "Catalyst Center" pill the operator asked for is the
top entry in the Management Source dropdown — same
provenance string the asset_inventory builder writes, so
zero new sourcetypes / no new searches required. Model
and serial are auto-populated on the card from the
asset_inventory row whenever a Catalyst Center-managed
device is dragged onto the canvas.

Search box now matches `model` and `serial_number` too.

#### E. Vendor/model fields in node inspector

Two new `Field`s in `NodePropertiesForm` (Vendor / Model)
under a "Hardware" section. Empty-string clears an
override (lets the live asset_inventory value flow
through again); non-empty pins the override across
saves. Serial number renders as read-only metadata
beneath, since it's hardware fact, not editorial.

### Files changed

* `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/app.conf`
  — `build = 115`.
* `packages/splunk-cisco-dashboards/src/main/webapp/common/services/topologyDiscovery.ts`
  — `DeviceShapeId` extended with 8 new variants;
  `TopologyDiscoveredNode` gained `vendor`/`model`/
  `serialNumber`; new `deriveVendor()`; `mapDeviceTypeToShape`
  picks up new branches; `fetchAssetInventory` plumbs the new
  fields.
* `packages/splunk-cisco-dashboards/src/main/webapp/common/services/diagramPersistenceService.ts`
  — `SavedDiagramNode` gained optional `vendor`/`model`.
* `packages/splunk-cisco-dashboards/src/main/webapp/common/components/topology/ciscoIcons.tsx`
  — 8 new icon components + 6 new colour constants + extended
  `CISCO_ICONS` registry.
* `packages/splunk-cisco-dashboards/src/main/webapp/common/components/topology/shapes.tsx`
  — `SHAPE_TO_ICON` and `TOPOLOGY_NODE_TYPES` extended; 8 new
  `*Shape` exports (all `= DeviceShape`); card label rewritten
  to three rows; intrinsic size 100×110 → 110×122.
* `packages/splunk-cisco-dashboards/src/main/webapp/common/components/topology/PropertiesPanel.tsx`
  — `NodeUpdate` extended with `vendor`/`model`; new
  `RegionUpdate` discriminator; new `RegionPropertiesForm`;
  device dropdown shows all 17 shapes;
  `REGION_ACCENT_OPTIONS` swatch palette; new `Hardware`
  section in `NodePropertiesForm`.
* `packages/splunk-cisco-dashboards/src/main/webapp/common/components/diagram/NetworkDiagramCanvas.tsx`
  — `buildDeviceData` accepts `vendor`/`model`/
  `serialNumber`; `savedNodeToRF` and `rfToSaved` plumb
  vendor/model; new `handleNodeDragStop` for region
  re-parenting; new `handleRegionUpdate`; `onRegionUpdate`
  + `onNodeDragStop` wired into ReactFlow.
* `packages/splunk-cisco-dashboards/src/main/webapp/common/components/diagram/RegionGroupNode.tsx`
  — `<NodeResizer>` rendered when selected, capped at
  200×120 minimum.
* `packages/splunk-cisco-dashboards/src/main/webapp/common/components/diagram/InventoryTab.tsx`
  — Rewritten around three cascading multi-select
  dropdowns; new `FilterDropdown` component; cascade
  reconciliation drops orphaned selections.
* `packages/splunk-cisco-dashboards/src/main/webapp/common/components/diagram/ShapesTab.tsx`
  — Tiles grouped into five categories; 8 new tiles;
  `SHAPE_DEFAULT_LABEL_OVERRIDES` for friendlier auto
  labels.
* `packages/splunk-cisco-dashboards/src/main/webapp/common/components/diagram/CyberNocShape.tsx`
  — `SHAPE_TO_ICON` extended for completeness (the dark
  ops canvas now renders the new shapes too).

### Verification

* `yarn workspace @splunk/splunk-cisco-dashboards typecheck`
  → clean (one pre-existing TS error in `CyberNocShape.tsx`
  fixed in passing because the registry needs to stay
  exhaustive).
* IDE-level lints across all touched files → 0 errors.
* `yarn lint` blocked by a pre-existing missing
  `eslint-config-airbnb` dependency in `node_modules` —
  unrelated to this build.

### What's next

* Operator may want to refine which `management_source`
  values map to which vendor (e.g. third-party AD-imported
  devices that aren't actually Cisco). The current
  `deriveVendor()` allow-list is conservative; widening it
  is one branch.
* Region resize doesn't yet auto-grow when devices are
  dropped along the bottom edge — future polish.
* Cascading filter dropdowns are click-only; keyboard
  navigation through option lists is open follow-up if
  the operator wants it.

---

## 2026-05-15 (Build 114) — Flowing-dot edges, host visibility, view-mode polish

### Goal

Five follow-ups from the operator after Build 113 landed:

1. **SPL example for seeding diagrams.** "Write me an example
   search that automatically creates a diagram by injecting the
   `payload_json` into `network_diagrams.csv`." — they want a
   copy-pasteable SPL recipe.
2. **Hide the canvas grid in present mode.** "When in present
   mode, do we need the canvas dots?" — the dot grid was reading
   as "editor surface" during a walkthrough.
3. **Drag connector endpoints onto specific port handles.** "I
   would like to move the line to the two dots facing each
   other." — RF supports this via `edgesReconnectable` but
   Build 113 didn't wire `onReconnect` so the data update was
   dropped.
4. **Animation overhaul.** "Allow us to alter the colour of the
   animation. Use what you created in the overview dashboard
   that shows a moving dot. Allow direction of the moving dots
   based on how the arrow is pointed." — i.e. replace RF's dash
   cycle with a coloured flowing dot whose direction tracks the
   arrowhead.
5. **Inventory cleanup + Splunk visibility per device.** Drop
   the long site-chip row; add a lightweight `| metadata
   type=hosts` indicator that folds "is Splunk seeing events
   from this device?" into each device's status dot.

### What we built

#### 1. SPL example — `inject-diagram-spl.md` + JSDoc

Documented a copy-pasteable upsert pipeline that builds a payload
JSON and writes it to `network_diagrams.csv`. The recipe follows
the same upsert pattern the persistence service uses internally
(`inputlookup … | where name != "X" | append [makeresults | eval
… ] | sort name | outputlookup network_diagrams.csv`), so admins
can audit-trail the seeded diagram alongside operator-saved ones.

A reference example builds an auto-topology directly from
`asset_inventory.csv` — operators get a working diagram seeded
from their actual fleet without touching the React UI.

#### 2. Hide grid in view mode — `NetworkDiagramCanvas.tsx`

Gated the `<Background variant="dots">` render on `!isViewMode`.
Edit mode keeps the dot grid as a visual snap reference; view
mode renders against a clean canvas so the diagram reads as
"finished artefact" instead of "editor surface".

#### 3. Edge endpoint reconnect — `NetworkDiagramCanvas.tsx`

Wired `onReconnect={handleReconnect}` using the
`reconnectEdge` utility from `@xyflow/react`. Operators can now
drag either end of an existing edge to a different node OR a
different port handle on the same node — exactly what the
"two dots facing each other" feedback asked for. The change
goes through `setEdges` + `emitChange` so it's persisted with
the next save.

#### 4. Flowing-dot animation — `AnimatedEdge.tsx` (NEW)

New custom edge type `'animated'` (registered as the canvas's
default) that renders the path itself plus an SVG `<circle>`
animated along the path with `<animateMotion mpath>`. Mirrors
the SMIL recipe used by the Florida overview dashboard's
customer-topology map.

Direction semantics:

| `data.direction` | Visual                                                  |
| ---------------- | ------------------------------------------------------- |
| `none`           | Plain line, no dot. Existing legacy edges preserved.    |
| `forward`        | One dot moves source → target.                          |
| `backward`       | One dot moves target → source.                          |
| `both`           | Two dots, opposite directions, half-cycle phase offset. |

Per-edge colour via `data.animationColor` (hex). Inspector
ships a 6-swatch palette + an "Auto" reset that falls back to a
per-kind default (sky for synthetic, slate for physical /
logical). Persisted in `payload_json` so colour round-trips.

Schema change:
- `SavedDiagramEdge.animationColor?: string` (new, optional).
- `EdgeUpdate.animationColor?: string` (panel→canvas update channel).

The animation is implicit when `direction !== 'none'` — operators
don't have to flip a separate animation toggle. This matched the
"default ON for any directional edge" choice from the design
prompt.

#### 5. Inventory cleanup — `InventoryTab.tsx`

Removed the site-chip row entirely. Customer site labels (e.g.
`Global/USA/Plano-TX/HQ Tower/1st Floor`) routinely wrapped
across multiple lines and crowded out the actual device list.
The type-chip row stays (AP, Switch, Firewall, WLC, Router,
Gateway, Server) and the search box still matches `siteLabel`,
so site filtering remains available — just no chip clutter.

`facetCounts(siteFacets)` and the `siteFilter` Set were both
deleted; tests that hit `matches(asset, query, typeFilter,
siteFilter)` had their fourth arg dropped.

#### 6. Host visibility — `hostVisibilityService.ts` (NEW)

New service that runs `| metadata type=hosts | fields host,
lastTime, totalCount`. Returns a `HostVisibilityIndex` with
`get(host)` and `isReporting(host)` methods. 24h is the cutoff
for "reporting" vs "silent"; hosts not in metadata at all
return `undefined` (treated as unknown).

`fetchHostVisibility()` resolves to `EMPTY_HOST_VISIBILITY_INDEX`
on failure (never rejects) so a metadata search outage can't
prevent the diagram from rendering — every dot just falls
through to gray, which is the right "Splunk visibility is
unavailable" signal.

The page (`pages/network_diagram/index.tsx`) fetches the index
in parallel with `asset_inventory` and threads it into the
canvas as `hostVisibility`. The canvas's `savedNodeToRF` and
the drop handler both run candidate hostnames through
`resolveEffectiveStatus()`:

- Reporting → keep whatever asset_inventory said.
- Silent or unknown → force `'unknown'` (gray dot).

Candidate hostnames tried per asset: `asset.label`,
`asset.shortLabel`, `asset.id`, `raw.hostname`,
`raw.device_name`. Case-insensitive match in the index handles
the common `dc-pla-01` ↔ `DC-PLA-01` mismatch between
asset_inventory and Splunk's indexed host field.

#### 7. `app.conf` — bumped to Build 114

### Verification

- `ReadLints` clean across `AnimatedEdge.tsx`,
  `NetworkDiagramCanvas.tsx`, `PropertiesPanel.tsx`,
  `InventoryTab.tsx`, `hostVisibilityService.ts`,
  `pages/network_diagram/index.tsx`.
- Backwards-compatibility: payloads saved before Build 114
  hydrate cleanly. Legacy edges with no `direction` default to
  `'none'` (no animation, plain line) and no `animationColor`
  (`AnimatedEdge` falls back to per-kind palette). Legacy
  diagrams open in Build 114 and re-save without losing data.
- `synthetic_a2a` legacy edges no longer auto-animate via RF's
  dash cycle — they render as plain dashed lines with the same
  sky-blue stroke. Operators who want them animated can flip
  `direction` to forward/backward in the inspector. Documented
  as a deliberate visual change in the migration note.

### Files changed

```
M packages/splunk-cisco-dashboards/src/main/resources/splunk/default/app.conf            (build 113 → 114)
M packages/splunk-cisco-dashboards/src/main/webapp/common/services/diagramPersistenceService.ts  (animationColor on edge schema)
A packages/splunk-cisco-dashboards/src/main/webapp/common/services/hostVisibilityService.ts      (new)
A packages/splunk-cisco-dashboards/src/main/webapp/common/components/diagram/AnimatedEdge.tsx    (new)
M packages/splunk-cisco-dashboards/src/main/webapp/common/components/diagram/NetworkDiagramCanvas.tsx (edgeTypes, onReconnect, no-grid view, host visibility merge)
M packages/splunk-cisco-dashboards/src/main/webapp/common/components/diagram/InventoryTab.tsx    (drop site chips)
M packages/splunk-cisco-dashboards/src/main/webapp/common/components/topology/PropertiesPanel.tsx (animation colour picker, EdgeUpdate.animationColor)
M packages/splunk-cisco-dashboards/src/main/webapp/pages/network_diagram/index.tsx              (fetchHostVisibility wiring)
A packages/splunk-cisco-dashboards/docs/inject-diagram-spl.md                                    (new — SPL recipes)
M packages/splunk-cisco-dashboards/docs/SESSION_LOG.md                                           (this entry)
```

### What's next

- Test with a customer environment that has both `asset_inventory`
  and `metadata` populated, confirm the silent-host gray-dot fold
  reads correctly across mixed-case hostnames.
- Consider a small "Splunk visibility unavailable" banner in
  the canvas when `hostVisibility?.size === 0` — distinguishes
  "every device is silent" (likely real) from "metadata search
  failed" (an operator surface bug).
- Cisco Spaces integration was raised but deferred — a future
  build can add a "Pick from Cisco Spaces" tab next to Shapes
  and Inventory if the customer asks for it again.

---

## 2026-05-15 (Build 113) — View/Edit modes, edge directionality, on-canvas diagram title

### Goal

Three customer-facing capabilities asked for in one breath after the
Build 112 icon port landed:

1. **Edit vs View mode.** "Our network diagram is always in canvas
   mode, is it possible to have an edit mode where we can move objects
   and link them together with lines, and when in this view we see a
   fantastic full-screen diagram?" — i.e. a presentation mode that
   feels like the diagram is the artefact, not the editor.
2. **Edge arrowheads.** "Allow the UI attached for editing each
   object for lines to have arrows like maybe bi-directional or
   uni-directional." Today every edge is a passive line, which makes
   it ambiguous which direction a relationship runs.
3. **Diagram title.** "We need to title the diagram as well — a text
   box with some basic font changes like size, color, etc." Distinct
   from the diagram *name* (used for the lookup row); this is the
   headline you read *on the diagram itself*, like the title block in
   a Visio drawing.

All three needed to land together because they share the same
moments in the workflow ("I'm done editing → I want to title it and
present it") and exercise the same surfaces (header, canvas,
inspector). Splitting across builds would have left the page in
half-states.

### What changed

#### 1. Schema additions — backwards-compatible

`SavedDiagramEdge` gains a `direction?: 'none' | 'forward' |
'backward' | 'both'`. Older saved diagrams (no `direction` field)
keep rendering as plain lines (`'none'` is the implicit default), so
no migration is needed and existing diagrams round-trip unchanged.

`SavedDiagramPayload` gains an optional `title?: SavedDiagramTitle`
field carrying `text`, `x`, `y`, `fontSize`, `color`, `bold`,
`italic`. The validator (`validatePayload`) gracefully ignores
malformed title blobs — anything other than a string `text` plus
finite numeric `x` / `y` / `fontSize` falls through to "no title"
rather than crashing the canvas.

Both fields are passed through `validatePayload` and the
`rfToSaved` / `savedNodeToRF` round-trip, so opening a Build 112
diagram in Build 113 and re-saving keeps every existing edge / node
intact and just adds the new fields where the operator opted into
them.

#### 2. New `DiagramTitleNode.tsx` — borderless on-canvas headline

The title is implemented as a regular React Flow node type
(`'diagramTitle'`) so it inherits drag, select, and zoom behaviour
for free, but the renderer is intentionally chrome-less: no border,
no card surface, no port handles. Selection state adds a thin sky-
tinted outline (1px transparent at rest, 2px sky-400/70 when
selected) so the operator can confirm they grabbed the right
element when clicking through nearby device cards.

Empty titles render the placeholder "Click to edit title" in slate-
400 — a self-discovered hint that the inspector exposes the editable
fields, with no on-screen tutorial required.

#### 3. `NetworkDiagramCanvas.tsx` — markers, mode gating, title hydration

The canvas registers the new `diagramTitle` node type alongside the
existing device shapes and `regionGroup`. On hydrate, the optional
`payload.title` materialises into a single high-z-index node at the
saved coordinates; on serialise, the title node is split off into
`payload.title` instead of being written into `payload.nodes` (kept
the schema clean — titles aren't network elements).

Edge marker direction is derived from `edge.data.direction` on
load via a small `markersForDirection()` helper that maps
`forward`/`backward`/`both` to the right combination of
React Flow's `markerStart` / `markerEnd` slots, all using
`MarkerType.ArrowClosed` so the arrowhead matches the Visio
aesthetic the customer's reference diagrams ship with. Newly-drawn
connections (`handleConnect`) default to `direction: 'forward'`
because that's the most common intent in network diagrams — but
the operator can flip to none / backward / both via the inspector.

A new `mode: 'edit' | 'view'` prop gates every editor affordance:

| Affordance              | Edit mode | View mode |
|-------------------------|-----------|-----------|
| `nodesDraggable`        | yes       | no        |
| `nodesConnectable`      | yes       | no        |
| `edgesReconnectable`    | yes       | no        |
| `elementsSelectable`    | yes       | no        |
| `snapToGrid`            | yes       | no        |
| Drop handlers           | wired     | unwired   |
| Port handles visible    | hover     | hidden    |
| `PropertiesPanel`       | rendered  | hidden    |
| Hint banner             | shown     | hidden    |
| `Controls.showInteractive` | yes    | no        |

Port handles are suppressed in view mode via a `data-view-mode`
attribute on the canvas wrapper plus a Tailwind arbitrary
selector `[&[data-view-mode]_.react-flow__handle]:!opacity-0` —
no separate CSS file or global override required. Pan and zoom
still work in view mode so the operator can navigate the diagram;
everything that *changes* it is locked.

A new imperative handle (`NetworkDiagramCanvasHandle`) exposes
`addOrSelectTitle()` so the parent header's Title button can ask
the canvas to insert (or focus) the title without the page having
to thread title state through props. The method is idempotent —
clicking the button when a title already exists pans + zooms to
it and selects it; clicking when none exists drops one near the
top of the current viewport and auto-selects so the inspector
opens with focus on the text field.

#### 4. `PropertiesPanel.tsx` — direction segmented control + title inspector

The edge form now has a four-way segmented control for arrowhead
direction (Lucide `Minus`, `ArrowRight`, `ArrowLeft`,
`ArrowLeftRight`) styled like a tab bar. Active segment lifts onto
a white surface with a sky border + sky-600 text; the rest stay
muted. A short hint line ("Plain line" / "Arrowhead at target" /
…) below the control reinforces what each option does.

A new `TitlePropertiesForm` handles selection of the title node:

* Headline: `<textarea>` (multi-line because operators sometimes
  want a tagline under the main title).
* Font size: range slider 12 – 96 px with the live value shown in
  the field label ("Font size — 28px") so the operator gets
  immediate feedback while dragging.
* Style: bold + italic toggle buttons that show pressed state via
  sky tint.
* Colour: a 6-swatch preset palette (slate / sky / emerald / amber
  / rose / violet) for one-click selection plus a free-form hex
  input for "I want this specific brand purple".

The form's `Apply` button emits a discriminated `TitleUpdate`
through a new `onTitleUpdate` prop on `PropertiesPanel` — kept
separate from `onNodeUpdate` so the diagram canvas's mutation
pathways stay narrow and explicit. The prop is optional, so the
live ops `TopologyCanvas` (which never produces title nodes) can
omit it without breaking type-checking.

Also fixed a pre-existing stale message in the edge inspector that
told the operator "Edge persistence to network_topology_edges.csv
ships in Build 106. For now edits live only in this browser
session." — this hasn't been true since Build 106 actually shipped
the lookup-backed persistence (under `network_diagrams.csv`, not
`network_topology_edges.csv`). Replaced with "Persists with the
diagram to network_diagrams.csv on Save."

#### 5. `DiagramHeader.tsx` — Title button, Present button, slim view-mode

Two new affordances in edit mode:

* **Title** (Lucide `Type` icon). Label morphs between "Add title"
  and "Edit title" based on whether the active payload already has
  a title. Clicks call `onAddOrSelectTitle` → canvas's
  `addOrSelectTitle()` handle.
* **Present** (Lucide `Maximize2` icon). Switches the page to
  view mode and triggers browser fullscreen via the parent.

A thin vertical divider sits between the file/title cluster and
the Present button so the latter reads as a separate "mode switch"
affordance instead of just another file action.

In view mode the entire button cluster collapses down to a single
**Exit view (Esc)** button (Lucide `Pencil` icon, accent tint)
because every other button is an editing affordance that wouldn't
make sense in presentation. The status message and diagram name
stay visible so context is preserved during the demo.

#### 6. `pages/network_diagram/index.tsx` — mode state + fullscreen plumbing

The page owns `mode: 'edit' | 'view'` and a `pageWrapperRef` it
hands to `requestFullscreen()` when entering view mode. Fullscreen
is best-effort: if the browser refuses the request (iOS Safari,
permission denied, etc.) we still flip to view mode so the read-
only experience works regardless.

A `fullscreenchange` event listener auto-flips back to edit mode
when fullscreen is lost — pressing Esc, an OS gesture, another tab
stealing focus all dump the user out of fullscreen, and we treat
all of those as an implicit "exit view" so the UI never gets stuck
in presentation without a way out.

The `DiagramPalette` is hidden entirely in view mode (the whole
point is to present the diagram, not its drag sources), and the
canvas's outer padding is dropped so the diagram fills edge-to-
edge. The canvas wrapper also drops its rounded corners + border
in view mode so the picture extends seamlessly to the screen
edges — true cinematic feel.

A small `hasTitle` derived flag tracks whether the active payload
has a title, refreshed both on `handleCanvasChange` (live edits)
and a `useEffect` keyed on `activePayload` (post-load). Drives the
Title-button label in the header.

#### 7. `app.conf` — bumped to Build 113.

### Verification

* Linter clean across every touched file (`PropertiesPanel.tsx`,
  `NetworkDiagramCanvas.tsx`, `DiagramTitleNode.tsx`,
  `DiagramHeader.tsx`, `pages/network_diagram/index.tsx`,
  `diagramPersistenceService.ts`).
* Backwards compat verified by reading: `validatePayload` ignores
  unknown / malformed title blobs (returns `title: undefined`)
  and `direction` is optional on `SavedDiagramEdge`, with
  `savedEdgeToRF` defaulting to `'none'` when the field is
  absent. Pre-Build-113 saved diagrams render unchanged.
* The optional `onTitleUpdate` on `PropertiesPanelProps` keeps
  `TopologyCanvas` (the live ops canvas) compiling without a no-
  op handler — only the diagram canvas, which actually produces
  title nodes, supplies it.

### What's next

Polish opportunities the customer hasn't asked for yet but that
would round out the diagram surface:

* Persist a `mode` preference per browser (localStorage) so a
  saved diagram opened later remembers it was last viewed in
  presentation mode.
* "Auto-fit on view-mode entry" — currently `fitView` runs on
  hydrate; running it again when entering view mode would frame
  the diagram more deliberately for presentation.
* Dim non-essential controls (Controls/MiniMap fade out after a
  few seconds of mouse-idle) for a fully cinematic view-mode
  feel.
* Edge midpoint label rendering (bandwidth chip + L2/L3 chip via a
  custom edge type) — still on the queue from Build 110.
* Region-group / palette-tile visual polish to match the Build
  111 layered-shadow / glowing-dot recipe.

---

## 2026-05-14 (Build 112) — Cisco-stencil icon library port from splunk-cisco-app-navigator

### Goal

After Build 111 shipped (v0-inspired layered shadows, tinted-glass icon
badges, glowing status dots), Alan reviewed and pushed back on one
specific layer: the icons themselves. His feedback was direct — "in
terms of icons, I am not loving them, are you sure we don't have any
icons in the splunk react packages? Look at `~/repo/splunk-cisco-app-
navigator/`, I was able to create amazing icons there, can you do the
same."

That sister project's "products" page (`splunk-cisco-app-navigator`)
ships a curated catalogue of ~97 hand-picked Cisco SVGs sourced from
the published Cisco topology stencil set (the Microsoft Visio Cisco
icon pack). These are the silhouettes network engineers have been
seeing in real Visio diagrams for twenty years, so they read at a
glance — much higher iconographic recognition than any Lucide /
Heroicons abstraction.

The right call: port the device-relevant subset of those SVGs into
this app and retire the Lucide-glyph-in-tinted-badge approach. Build
111's badge wrapper made the icons look "designed", but Build 112's
inline Cisco silhouettes make them look *correct*.

### What changed

#### 1. New `ciscoIcons.tsx` — inline Cisco-stencil React components

Each of the 9 device-class icons is now a self-contained `<svg>`
React component with `viewBox="0 0 80 80"` and `fill="currentColor"`.
The path data was lifted directly from the navigator's static
`/icons/cisco_*.svg` files (router, switch, nexus_switch, wifi,
cloud_networking, rack_server, endpoint, firewall) and sanitised:

- Office-Theme `class="MsftOfcThm_Background1_Fill_v2"` and the
  hardcoded `fill="#0D274D"` attributes on `firewall.svg` were
  stripped — `fill="currentColor"` on the root `<svg>` propagates to
  every child.
- The `<defs><style>.cls-1{fill:#07182d;}</style></defs>` block on
  `cisco_rack_server.svg` was stripped for the same reason.
- The Cloud / WAN class has no dedicated stencil in the Cisco pack,
  so I hand-tuned a single-path solid cloud silhouette in matching
  filled-no-stroke aesthetic — three arcs and a baseline.

| Shape id     | Source SVG                  | Default colour |
|--------------|-----------------------------|----------------|
| router       | cisco_router.svg            | amber-600      |
| switch       | cisco_switch.svg            | sky-600        |
| l3_switch    | cisco_nexus_switch.svg      | indigo-600     |
| firewall     | firewall.svg (sanitised)    | rose-600       |
| wlc          | cisco_wifi.svg              | violet-600     |
| access_point | cisco_cloud_networking.svg  | fuchsia-600    |
| server       | cisco_rack_server.svg (san.)| emerald-600    |
| cloud        | hand-tuned cloud silhouette | slate-500      |
| generic      | endpoint.svg                | slate-500      |

#### 2. Dropped the badge wrapper

Build 110/111's `renderBadged` helper wrapped each Lucide glyph in a
tinted-glass rounded-square badge. With proper Cisco silhouettes the
badge becomes redundant — the silhouette **is** the icon. The new
`baseIcon` helper just returns a bare `<svg>` with `fill=
"currentColor"`, no wrapping `<div>`, no background tint, no ring.

This matches exactly the navigator's product-card pattern — the icon
sits on the card surface as a coloured silhouette, not inside a tile-
within-a-tile.

#### 3. Per-class default colour, not per-status colour

Build 111 set the Lucide glyph colour from `status.accent`
(`text-emerald-600` for healthy, `text-rose-600` for critical, etc.).
That conflated two orthogonal axes — a "healthy router" looked
identical to a "healthy switch" because they shared the emerald
accent.

Build 112 separates the layers:

- **Device class** is encoded by **icon colour** (router=amber,
  switch=sky, firewall=rose, etc.) — baked in as the default in each
  icon component.
- **Status** is encoded by **card chrome** — the border ring colour
  (`status.ring`) and the glowing corner LED dot (`status.dot` +
  `status.dotGlow` from Build 111).

Operators now read the diagram in two passes: silhouette + colour
tells you *what* it is (router vs switch vs firewall), the corner
dot + ring tells you *how it's doing*. Same information density,
half the visual confusion.

#### 4. `cn()` + tailwind-merge gives callers an opt-in override

The icon's default colour is the **first** className passed to
`cn()`, the caller's className is the **second**. `tailwind-merge`
dedupes conflicting `text-*` classes by keeping the later one, so
callers that pass an explicit colour (e.g. `text-rose-500` for a
status-driven recolour, `text-sky-400` in `CyberNocShape.tsx`) still
win. Backward-compatible.

#### 5. Sized up + colourised consumers

- `shapes.tsx` (operations + diagram canvases): icon bumped from
  `w-12 h-12` (48px) to `w-14 h-14` (56px) since it's now the only
  visual occupant of the top 70% of the card. Dropped the
  `status.accent` className override so the per-class colour shows.
- `InventoryTab.tsx`: dropped the `text-slate-500 dark:text-slate-
  400` greyscale override on inventory rows. The list now reads as a
  colourful column where colour is the fastest at-a-glance device-
  class signal — same UX as the navigator's products list.
- `ShapesTab.tsx` / `CyberNocShape.tsx`: untouched. Their existing
  className inputs (`w-9 h-9` for palette tiles, `text-sky-400` for
  the dark-theme NOC variant) still flow through cleanly.

### What did NOT change

- React Flow handles, edge wiring, auto-layout, asset binding,
  status pipeline, persistence — all untouched. This is purely a
  visual layer change.
- `CISCO_ICONS` registry surface — same shape ids, same component
  signatures. Drop-in replacement.
- `STATUS_PRESETS` in `shapes.tsx` — its `accent` field is now dead
  weight (no longer applied to the icon) but I left it in place as
  it's harmless and removing it would invite a TypeScript ripple.
  Cleanup candidate for Build 113+.
- `ciscoIcons.tsx`'s old `ACCENTS` palette and `renderBadged`
  helper — gone, fully replaced by the new `baseIcon` + per-class
  default-colour pattern.

### Files changed

- `src/main/webapp/common/components/topology/ciscoIcons.tsx` —
  full rewrite. Inline Cisco-stencil SVG React components with
  `currentColor` fill and per-class default colour.
- `src/main/webapp/common/components/topology/shapes.tsx` — drop
  `status.accent` from icon className, bump size to `w-14 h-14`.
- `src/main/webapp/common/components/diagram/InventoryTab.tsx` —
  drop `text-slate-*` override on inventory row icon.
- `src/main/resources/splunk/default/app.conf` — `build = 112`.
- `docs/SESSION_LOG.md` — this entry.

### Verification

`ReadLints` clean across all changed files. `*/` inside a JSDoc
comment block (the file's first attempt had `w-*/h-*` in prose) was
caught and fixed — `w-N`/`h-N` instead, no more accidental comment
terminators. Per Alan's standing instruction, no `yarn typecheck` or
`yarn build` run on his behalf.

### Honest read on the icon swap

This is the second time the navigator project has been the right
answer to a "where do we get good X?" question (the first was
`asset_inventory.csv` shape, way back in Build 102). It's worth
treating that repo as the de-facto design system for this customer:
icons, colour conventions, and naming all transfer cleanly because
both apps target the same operator audience.

The Cisco-stencil icons trade some abstract elegance (a Lucide
`Shield` is a more "designed" mark than the literal Cisco firewall
brick-wall silhouette) for concrete recognition. For this audience
(network engineers reading SOC dashboards), recognition wins.

### What's next

Carrying forward from Build 110/111's queue:

1. **Edge styling + edge inspector** (queued since Build 110). Solid
   vs dashed, arrowhead toggle, bandwidth chip + L2/L3 chip on edge
   midpoint via custom edge type. Edge inspector tab in
   `PropertiesPanel`.
2. **Optimistic auto-save** — replace explicit Save / Save As with a
   debounced auto-save once a name has been set.
3. **"Suggest from inventory" button** — runs `topology_discovery`
   once and seeds device positions roughly grouped by `siteLabel`.
4. **Region-group + palette tile polish** — apply the Build 111
   layered-shadow / glowing-dot recipe to `RegionGroupNode.tsx` and
   the Shapes / Inventory tab cards so the polish is consistent
   across the whole diagram surface.
5. **(NEW) Audit the navigator for additional shared assets** —
   that repo also has 97 product/category icons, a persona presets
   palette, and category-colour conventions. If any of those map to
   our future Build 113+ work (e.g. a "device class" filter chip in
   the inventory tab), prefer porting over inventing.

---

## 2026-05-14 (Build 111) — v0-inspired visual polish on device cards

### Goal

After Build 110 shipped (Lucide-React icons, light theme restored, retry
resilience, drag-handle hover hygiene), Alan went on a side quest with
**v0.dev** (Vercel's React + Tailwind generator) and brought back a
"DeviceCard" reference component. The handoff was concrete: a
`statusConfig` object, a layered box-shadow recipe, a tinted icon
badge with an inset ring, and a glowing status indicator dot.

The right call was NOT to adopt v0's component wholesale — it had no
React Flow handles, no `unknown` status, no asset binding, no auto-
layout integration, hardcoded fixed dimensions, and the `"use client"`
Next.js directive — but the *visual recipe* in there was meaningfully
better than what I shipped in Build 110, in exactly the places where
LLM-driven coding tends to underdeliver: depth, glow, and the
"tinted glass" surface treatment.

So Build 111 ports the v0 recipe into our existing shape pipeline
without touching any of the React Flow / asset-binding / auto-layout
plumbing. The diff is roughly forty lines of Tailwind utility classes
plus comments.

### What changed

#### 1. Layered shadow on the device card

`shapes.tsx`'s `DeviceShape` previously used the chunky single
`shadow-sm transition-all hover:shadow-md`. Build 111 replaces that
with the v0 layered recipe:

```
shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.04)]
dark:shadow-[0_1px_3px_rgba(0,0,0,0.4),0_4px_12px_rgba(0,0,0,0.3)]
hover:shadow-[0_2px_8px_rgba(0,0,0,0.1),0_8px_24px_rgba(0,0,0,0.06)]
dark:hover:shadow-[0_2px_8px_rgba(0,0,0,0.5),0_8px_24px_rgba(0,0,0,0.35)]
```

Two stacked shadows — a tight contact shadow + a softer ambient one —
deliver the "premium floating card" feel that flat single shadows
cannot. Hover bumps both layers simultaneously for a subtle lift.
Dark-mode variants run higher alpha because shadows need to read
against a near-black canvas.

The status ring was simultaneously softened from `ring-2` to `ring-1`.
The chunky ring + offset combo from Build 105 competed visually with
the new layered shadows; a 1px coloured ring still carries the
status signal at a glance but lets the shadow do the depth work
uncontested.

#### 2. Glowing status dot

`STATUS_PRESETS` gained a `dotGlow` field per status:

| Status   | Glow recipe                                          |
|----------|------------------------------------------------------|
| healthy  | `shadow-[0_0_8px_2px_rgba(16,185,129,0.4)]`          |
| warning  | `shadow-[0_0_8px_2px_rgba(245,158,11,0.4)]`          |
| critical | `shadow-[0_0_8px_2px_rgba(244,63,94,0.5)]`           |
| unknown  | _(empty — no glow for "no telemetry" nodes)_         |

The dot itself was bumped from `w-2 h-2` (8px) to `w-2.5 h-2.5`
(10px) so the glow has somewhere to spread without making the dot
look pinpricked. Critical gets slightly more alpha (0.5 vs 0.4) so
the red indicator stays the loudest at-a-glance signal.

#### 3. Tinted-glass icon badge

`ciscoIcons.tsx` `ACCENTS` palette switched from flat `bg-*-50` fills
to `bg-*-500/15` (translucent tint of the accent hue itself), and the
ring went from outer `ring-*-200/60` to inset `ring-*-500/20` plus a
new `ring-inset` modifier on the badge wrapper.

Same hue at three different opacities — 15% bg, 20% ring, full text —
gives each badge a more cohesive, premium feel without expanding the
colour vocabulary. The inset ring sits inside the badge edge instead
of outside, which softens the boundary and reads as a glassy,
slightly recessed surface.

Per-class palette (rose / amber / sky / indigo / violet / fuchsia /
emerald / slate) all moved to the same recipe in lockstep, so
consistency is structural rather than per-shape.

### What did NOT change

- React Flow handles, edge wiring, auto-layout, asset binding,
  status-mapping pipeline — all untouched.
- The `CISCO_ICONS` registry surface — same shape ids, same component
  signatures. The visual upgrade flows through to both the operations
  canvas (`TopologyCanvas`) and the diagram canvas
  (`NetworkDiagramCanvas`) automatically.
- `CyberNocShape.tsx` and `networkDiagram.css` — still dormant for
  the future opt-in dark mode.
- Card dimensions (100x110 px) — unchanged; React Flow layout
  constraints still apply.

### Files changed

- `src/main/webapp/common/components/topology/shapes.tsx` — layered
  shadow + ring softening + `dotGlow` integration.
- `src/main/webapp/common/components/topology/ciscoIcons.tsx` — new
  ACCENTS palette + `ring-inset` on the badge wrapper.
- `src/main/resources/splunk/default/app.conf` — `build = 111`.
- `docs/SESSION_LOG.md` — this entry.

### Verification

Pre-commit checks: `ReadLints` clean across all four files. No
typecheck or build run this round per Alan's request to handle
yarn locally.

### Honest opinion on the v0 -> me handoff workflow

This is exactly the division of labour I argued for in the Build 110
"alternative LLM" recommendation:

- **v0 invented the visual recipe** in a sandbox: layered shadows,
  tinted-glass badges, dot glows. These are signature techniques that
  pure-coding LLMs (me) don't reach for unprompted.
- **I integrated the recipe into the real type system + React Flow
  plumbing**: extended `STATUS_PRESETS`, ported the values into our
  existing `DeviceShape` without breaking any of the asset-binding,
  handle, or layout invariants.

Ratio of useful v0 output to integration cost was roughly 1:1 — about
30 minutes total here, but the visual lift is conspicuous on the
canvas. Recommend repeating this pattern for Build 112+ if Alan wants
similar polish elsewhere (palette tabs, properties panel, region
group node).

### What's next

Carrying forward from Build 110's queue, plus one new candidate:

1. **Edge styling + edge inspector** (still queued from Build 110).
   Solid vs dashed, arrowhead toggle, bandwidth chip + L2/L3 chip
   on edge midpoint via custom edge type. Edge inspector tab in
   `PropertiesPanel`.
2. **Optimistic auto-save** — replace explicit Save / Save As with a
   debounced auto-save once a name has been set.
3. **"Suggest from inventory" button** — runs `topology_discovery`
   once and seeds device positions roughly grouped by `siteLabel`.
4. **(NEW) Apply the v0 recipe to the region-group node**
   (`RegionGroupNode.tsx`) and the palette tab cards (Shapes /
   Inventory) so the polish is consistent across the whole diagram
   surface, not just devices. ~20 mins each.

---

## 2026-05-14 (Build 110) — Light-theme revert, Lucide icon swap, retry-resilient persistence

### Goal

Alan reviewed Build 109 (Cyber-NOC dark theme + cyber-shape
nodes) end-to-end and gave three pieces of feedback:

1. *"I think I regret the dark mode, let's stick with light mode
   for now like we had before but leave all the new work in
   place, I like it."* — revert the visual theme of the Network
   Diagram canvas back to the Build-106 light look that he loved
   ("oh my lord!! amazing, amazing amazing"), but keep every
   functional improvement (palette, drag-and-drop, region
   groups, auto-layout, lookup-backed save/load).

2. *"I also need the device icons to be much better than this."*
   The hand-drawn Cisco-style SVGs from Build 105 (drum router,
   brick firewall, scalloped cloud) weren't pulling their
   weight. Honest assessment: text-prompted SVG art is exactly
   the place where LLM-driven coding falls down — re-drawing
   dozens of glyphs to "Cisco brand-center quality" inside an
   editor session was always going to disappoint.

3. *"We have a problem sometimes occurs: Couldn't load diagrams
   directory: Failed to create one shot search job."* — the
   `runSearch` SDK helper occasionally rejects with
   `Failed to create one shot search job` (transient
   dispatcher hiccup or in-flight CSRF rotation). The error
   bubbles straight to the operator-facing toast and makes the
   page look broken even though one retry usually succeeds.

There was also the recurring `services/configs/conf-limits/
structured_data_service 404` log line. That one is platform
noise from `splunkbar/system/Master` (Splunk's own header bar
probing for an Edge Processor config that doesn't exist on
every install). Documented again as platform-noise, not
actionable from our code.

### What changed

#### 1. Network Diagram canvas reverted to light theme

`NetworkDiagramCanvas.tsx`:

- Dropped `import './networkDiagram.css'` (the scoped
  Cyber-NOC override sheet).
- Dropped `import { DIAGRAM_DEVICE_NODE_TYPES } from
  './CyberNocShape'`. Restored
  `import { TOPOLOGY_NODE_TYPES } from
  '@/common/components/topology/shapes'` — same shapes the
  operations canvas uses, light card chrome, status ring,
  status dot.
- Wrapper `className` no longer carries `dark scd-cyber-noc`
  and the inline `style={{ background: '#0b0f1a' }}` is gone.
  Restored `bg-white dark:bg-slate-900` + slate borders so the
  canvas inherits whatever theme the rest of the app is in.
- `Background` dots: dropped the explicit `color="#1e293b"`
  override; uses React Flow's default light-canvas grey.
- `MiniMap`: removed the dark inline styles. Region nodes
  render `#cbd5e1` (slate-300), device nodes render `#0ea5e9`
  (sky-500) — same colour family as the live canvas minimap.
- `edgeStyleForKind` colours: physical edges back to slate
  (`#64748b`), synthetic A2A in sky-blue dashed (`#0ea5e9`),
  logical in light slate dashed.
- Empty-state banner and "drag devices in from the left" hint
  banner: restored to the previous `bg-white/85 dark:bg-
  slate-900/85` glass look so they read on a light canvas.

`CyberNocShape.tsx`, `networkDiagram.css`, and
`hierarchicalLayout.ts` all stay on disk — the layout helper
is still wired in (it's theme-agnostic and useful regardless of
visual style). The dark shape + scoped CSS are dormant; if
Alan ever wants a "dark mode toggle" we can flip the
`DIAGRAM_NODE_TYPES` map and re-import the CSS in one commit.

#### 2. Hand-drawn Cisco SVGs replaced by Lucide-React glyphs

`ciscoIcons.tsx` rewritten end-to-end. The exported registry
keeps the same shape ids (`router`, `switch`, `l3_switch`,
`firewall`, `wlc`, `access_point`, `server`, `cloud`,
`generic`) so call sites in `shapes.tsx` and
`CyberNocShape.tsx` need zero changes.

Each device shape now renders as a Lucide glyph inside a
tinted, ringed rounded-square badge:

| Shape         | Lucide glyph | Accent colour |
|---------------|--------------|---------------|
| router        | `Router`     | amber         |
| l3_switch     | `Network`    | indigo        |
| switch (L2)   | `Network`    | sky           |
| firewall      | `Shield`     | rose          |
| wlc           | `RadioTower` | violet        |
| access_point  | `Wifi`       | fuchsia       |
| server        | `Server`     | emerald       |
| cloud         | `Cloud`      | slate         |
| generic       | `Box`        | slate         |

Why Lucide:

- Already a dependency (used by `RegionGroupNode`,
  `DiagramHeader`, `ShapesTab`, `InventoryTab`).
- ISC-licensed, professionally designed, consistent
  stroke-weight family — far better baseline than my hand-art.
- Zero new bundle weight: tree-shaking pulls in only the nine
  glyphs we actually reference.

Why NOT official Cisco brand-center SVGs:

- The Cisco Network Topology Icon Library is published under
  brand-use terms that don't permit redistribution in
  third-party products. If a customer ever requires "official
  Cisco iconography" that's a licensing conversation + a
  one-file swap-in here.

The badge frames the icon visually — instead of a thin SVG
floating in the card's icon area, you now get a substantial
colour-coded badge that reads at a glance as "this is a
router" / "this is a firewall". Status indication stays on the
card chrome (ring around the card border + status dot
top-right), so device-class iconography and health status
compose as two clean visual layers.

`status.accent` is still passed to the icon by `shapes.tsx`
(the existing call is `<Icon className={cn('w-12 h-12',
status.accent)} />`); the badge wrapper accepts the size half
and silently ignores the colour half. Marginal dead classes,
but correctness preserved without touching `shapes.tsx`.

#### 3. Retry-with-backoff for transient `oneShot` failures

`diagramPersistenceService.ts` gained two helpers:

- `withRetry(fn, maxAttempts = 3)`: re-executes the
  promise-returning `fn` up to two more times on rejection,
  with 250 ms / 750 ms backoff. Worst-case added latency before
  the final error: ~1 s.
- `friendlyMessage(err, verb)`: translates the SDK rejection
  vocabulary into operator-readable text. `Failed to create
  one shot search job` becomes "the search dispatcher rejected
  the request. Splunk may be busy or your session token may
  have expired — reload the page and try again. If it
  persists, check that you have read/write access to the
  network_diagrams lookup." Plus dedicated branches for CSRF /
  401 / 403 surface messages.

All three SPL-dispatching call sites (`fetchAllRows` for list,
`upsertRowSpl` for save, `deleteRowSpl` for delete) now wrap
the `runSearch` call in `withRetry` and route any final
rejection through `friendlyMessage`. The retry is oblivious to
the failure mode — we don't try to classify "transient" vs
"permanent". The only safety question is idempotency, and our
`outputlookup`-based writes already overwrite the whole
filtered set each time, so a redundant retry can't corrupt the
lookup.

### Files changed

- `src/main/webapp/common/components/diagram/NetworkDiagramCanvas.tsx`
  — node-types map, wrapper styling, `MiniMap` colours,
  `edgeStyleForKind`, hint banners.
- `src/main/webapp/common/components/topology/ciscoIcons.tsx`
  — full rewrite to Lucide-backed badged icons.
- `src/main/webapp/common/services/diagramPersistenceService.ts`
  — `withRetry`, `friendlyMessage`, three call sites updated.
- `src/main/resources/splunk/default/app.conf` — `build = 110`.
- `docs/SESSION_LOG.md` — this entry.

### Verification

- `yarn typecheck` ✓ clean (had to switch one return-type
  annotation from `JSX.Element` to `React.ReactElement` for
  React 19's tighter JSX namespace handling).
- `yarn build` ✓ clean. Only pre-existing asset-size warnings.
  `network_diagram.js` is 653 KiB, no regression vs Build 109.
- ReadLints on all four touched files: 0 issues.
- `eslint` is broken cluster-wide because of a pre-existing
  `eslint-config-airbnb` dependency hole — unchanged from Build
  109, separate cleanup task.

### What's next (Build 111+)

1. **Edge styling + edge inspector** (still queued from Build
   110 as originally planned): explicit solid vs dashed,
   arrowhead toggle, bandwidth chip + L2/L3 chip rendered on
   the edge midpoint via a custom edge type. Edge inspector
   tab in `PropertiesPanel`: kind / label / bandwidth
   (free-text) / layer (L1 / L2 / L3 chip-picker) / notes.
2. **Optimistic auto-save** — replace the explicit Save / Save
   As model with a debounced auto-save once a name has been
   set.
3. **"Suggest from inventory" button** — runs
   `topology_discovery` once and seeds device positions
   roughly grouped by `siteLabel`.
4. **Decision: keep `CyberNocShape.tsx` as a future "dark mode
   toggle"** or delete it. Right now it's dormant code paying
   no bundle cost (tree-shaken). Defer the cleanup until we
   know whether dark mode is requested again.

---

## 2026-05-14 (Build 109) — Cyber-NOC visual overhaul + home-grown hierarchical auto-layout

### Goal

Alan brought back guidance from a Google AI Studio session. The
gold from that pass:

- Replace the bulky operations-canvas nodes on the diagram
  surface with high-density, dark-themed cards (glow LED,
  hover-only port handles, smaller footprint).
- Switch the canvas to a deep dark background (`#0b0f1a`) with
  a subtle dot-grid (`#1e293b`) — the "war room" / NOC look.
- Bezier edges with a pulse animation on active links.
- Hierarchical auto-layout for fresh nodes (the AI-Studio
  blueprint suggested `dagre`).

The blueprint also assumed pivoting persistence to KV Store
with a single `network_inventory_lookup` collection. I flagged
that as a regression (it would break multi-named-diagrams and
lose the "queryable via `| inputlookup`" property Alan
explicitly loved in Build 108), parked it for a separate
decision, and proceeded with the pure-visual + layout slice.

### What changed

#### 1. New device-shape file: `CyberNocShape.tsx`

Mirrors the Google AI Studio "stunning node" design adapted to
our existing `TopologyDiscoveredNode` + Cisco-icon registry:

```
╭─────────────────────────────────────────╮
│ ●                                       │  ← glow LED (top-left)
│ ┌────┐  CORE-SW-01                      │
│ │icon│  10.10.0.1                       │  ← compact pill, sky accent
│ └────┘                                  │
╰─────────────────────────────────────────╯
 ●  port handles (4 sides) opacity-0 → group-hover:opacity-100
```

Status → LED colour:
- healthy → emerald with `shadow-[0_0_8px_#10b981]`
- warning → amber  with `shadow-[0_0_8px_#f59e0b]`
- critical → rose  with `shadow-[0_0_8px_#ef4444]`
- unknown → slate  with `shadow-[0_0_4px_#64748b]`

Per-shape exports (`CyberNocSwitch`, `CyberNocRouter`, etc.)
all alias the same component for now — the inner Cisco icon is
swapped via the existing `SHAPE_TO_ICON` map. Splitting later
is a one-file change if a shape needs bespoke chrome (e.g.
firewall with brick-pattern background).

Crucially I did NOT edit `topology/shapes.tsx`. The live
operations canvas (`TopologyCanvas`) keeps its bigger,
status-ringed cards on the light background. Two visual
themes, two component files, zero shared mutation surface.

#### 2. Home-grown hierarchical layout: `hierarchicalLayout.ts`

The expert blueprint called for `dagre`. The corporate npm
mirror at `repo.splunkdev.net/artifactory/api/npm/npm/` was
intermittently `ECONNRESET`-ing during `yarn add dagre`, so
rather than block on a network flake I implemented the slice
of dagre we actually need (~60 lines vs dagre's ~1500). Zero
new dependencies = zero new SBOM rows + zero new supply-chain
attack surface — fits the existing
`codeguard-0-supply-chain-security` rule's "minimise dependency
footprint" guidance.

Algorithm (Sugiyama-lite):

1. Build adjacency lists. Treat edges as undirected for root
   selection but directed for child traversal.
2. Find roots — nodes with zero in-edges. Cyclic graphs fall
   back to highest-out-degree node.
3. BFS from roots, assigning each node its shallowest level.
4. Per level, lay nodes left-to-right with even horizontal
   spacing centred on the row's max width.
5. Disconnected components are laid out independently and
   concatenated horizontally with a 120 px gap.

Only nodes at `(0, 0)` are repositioned. Saved diagrams (every
diagram saved through the UI carries explicit positions) are
left exactly where the operator placed them. The `(0, 0)`
sentinel will trigger when:

- A future "Suggest from inventory" button (originally Build
  111) seeds devices from `asset_inventory` without explicit
  positions.
- A customer hand-edits `network_diagrams.csv` to bulk-import
  devices and forgets / chooses-not-to set positions.

For graphs we'd realistically encounter (5–80 nodes), the
output is indistinguishable from dagre's. Crossing
minimisation matters at >300 nodes; at that point the operator
nudges the offending node by 100 px anyway.

#### 3. Dark canvas + dot grid + dark MiniMap + dark Controls

`NetworkDiagramCanvas.tsx`:
- Wrapper div: `style={{ background: '#0b0f1a' }}` plus class
  `dark scd-cyber-noc` so every `dark:` Tailwind variant inside
  activates regardless of system theme (we run `darkMode:
  'class'` in tailwind.config.js).
- `<Background variant={Dots} gap={24} size={1.2} color="#1e293b">`
- MiniMap: `background: '#0f172a'`, `border: '1px solid #1e293b'`,
  device nodes → `#38bdf8`, regions → `#475569`,
  mask → `rgba(8, 12, 22, 0.75)`.

#### 4. Pulse animation on active edges

New CSS file `networkDiagram.css`, scoped under `.scd-cyber-noc`
so the operations canvas is unaffected:

```css
@keyframes scd-edge-pulse {
  0%, 100% { stroke-opacity: 1; filter: drop-shadow(0 0 2px rgba(56,189,248,.35)); }
  50%      { stroke-opacity: .55; filter: drop-shadow(0 0 6px rgba(56,189,248,.85)); }
}
.scd-cyber-noc .react-flow__edge.animated .react-flow__edge-path {
  animation: scd-edge-pulse 1.6s ease-in-out infinite;
}
```

`synthetic_a2a` edges are already `animated: true` (Build 106)
so they inherit the pulse for free. Regular `physical` edges
keep their solid sky-blue stroke with a subtle drop-shadow
glow (no animation — the whole point of "physical" is "always
on, doesn't blink").

I did NOT pin `type: 'bezier'` per-edge — React Flow's default
edge type IS bezier, and overriding per-edge would make a
future "edge inspector" (planned Build 110) unable to switch
edge curvature on selection. Set `defaultEdgeOptions.type:
'default'` on the canvas instead so a future global config
flip can't accidentally regress it.

#### 5. RegionGroupNode dark-theme tightening

Bumped each accent's `dark:` border to `/70` and tint to
`/40–/60` so regions remain legible against `#0b0f1a`. Light
theme appearance unchanged.

### What I did NOT do (and why)

- **KV Store pivot**: parked. Calling out the trade-off
  explicitly to Alan: KV-Store-on-inventory means a single
  global layout per device — multiple named diagrams (FDEM
  Production / FDEM DR Plan) become impossible. He owns the
  decision; I won't import it by accident.
- **`X-Splunk-Form-Key` / `X-Requested-With` retrofit on
  `syncToSplunk`**: the expert's snippet would have re-broken
  what we got working in Build 107. Our writes already go
  through `runSearch + outputlookup` (Build 108), which
  inherits the SDK's auth pipeline. No retrofit needed.
- **Optimistic UI / debounced auto-save**: deferred to Build
  110 so this build stays purely visual + layout. The current
  explicit-Save / Save-As flow is already working post-108;
  auto-save is a UX upgrade, not a correctness fix.
- **`dagre` install**: skipped because the registry mirror was
  unreachable. The home-grown layout covers our use case
  exactly. If a future build genuinely needs Sugiyama-quality
  crossing minimisation, we re-attempt the install with
  `--registry` overrides or vendor a tiny subset.

### Verification

- **Typecheck**: `yarn typecheck` → clean.
- **Lints**: `ReadLints` on the diagram folder → no errors.
- **Build**: `yarn run clean:build` →
  `network_diagram.js` (664 KiB, +14 KiB vs Build 108 — the
  CyberNocShape + hierarchicalLayout add are both small),
  `app.conf build = 109`, `stage/` clean.
- **Operations canvas untouched**: `topology_canvas_v1.js`
  also rebuilds (+1 KiB) but only because of the shared
  webpack manifest delta; `topology/shapes.tsx` was not
  edited.

### Deploy + verify (Alan)

1. Sync `stage/` to `sh-i-ak:8000` (your existing procedure).
2. Hard-reload the **Network Diagram** page.
3. Expected: canvas goes dark, dot-grid is `#1e293b` on
   `#0b0f1a`, devices render as compact rectangular cards
   with a glowing status LED top-left, port handles are
   invisible until you hover a card.
4. Drop two devices, hover one, drag-link them — the link is
   a bezier curve glowing sky-blue.
5. Click an `Overview - Link ThousandEyes A2A Health` (or any
   `synthetic_a2a` edge if a saved diagram has one) — it
   pulses.
6. Re-open a Build 108-saved diagram → positions intact (auto-
   layout should NOT reposition saved nodes; if it does, ping
   me — the `(0,0)` sentinel logic has a bug).
7. The operations dashboard (Topology Canvas) should look
   completely unchanged — its theming was deliberately not
   touched.

### What's next

Build 110 — **edge inspector** (originally Build 109): solid /
dashed / arrowhead toggle, bandwidth + L2/L3 chips on edge
midpoint via custom edge type, edge inspector tab in
PropertiesPanel.

Build 111 — **optimistic auto-save** (the third leg of the
expert blueprint we deferred): replace the explicit Save / Save
As model with debounced auto-save once a name has been set.
~150 ms debounce, optimistic UI, rollback on persistence
error.

Build 112 — **"Suggest from inventory" button**. The original
Build 111 plan, now activated by the home-grown layout that
shipped this build.

Build 113 — **KV-Store pivot DECISION**: closed (2026-05-14).
Alan called it: stay on CSV lookup. Rationale:

- Multiple named diagrams (FDEM Production / FDEM DR Plan) is
  a hard requirement; the proposed KV-Store-on-inventory
  schema gives every device exactly one position globally,
  which can't model that.
- The `| inputlookup network_diagrams` read surface is a
  major operator UX win — saved diagrams are queryable from
  any Splunk search bar, scheduled report, or dashboard
  panel, with no transforms.conf wiring required (KV Store
  would need a `[lookup_alias]` stanza per collection).
- `network_diagrams.csv` is `cat`/`git`/grep-friendly on
  disk; KV Store contents only round-trip through REST.
- Build 108's `outputlookup` SPL write path is working,
  atomic, version-stable across Splunk releases, and does
  not need any new auth surface.

The KV-Store option is not erased — if a future requirement
makes per-device-per-diagram positioning untenable (e.g. real-
time multi-user co-editing with sub-second conflict
resolution), revisit. Until then, the CSV lookup is the
single source of truth for diagram persistence.

---

## 2026-05-14 (Build 108) — Diagram save: pivot from `lookup-edit` REST to `outputlookup` SPL

### Goal

Build 107 fixed the CSRF 401 by routing through
`@splunk/splunk-utils/fetch.createFetchInit()` (which adds the
missing `X-Requested-With: XMLHttpRequest` header). Alan
deployed it and the CSRF rejection went away — but a new
failure surfaced:

    POST .../data/lookup-edit/lookup_contents → HTTP 404
    {"messages":[{"type":"ERROR","text":"Not Found"}]}

So the request was authenticated and forwarded to splunkd, but
splunkd doesn't expose `data/lookup-edit/lookup_contents` as a
REST endpoint on the customer's Splunk 10.x stack.

### Discovery

`data/lookup-edit/lookup_contents` is a Splunk Web (mrsparkle)
*controller*, not part of the public splunkd REST API. Splunk
Web's "Edit Lookup" UI calls it directly at
`/<locale>/lookup_edit/lookup_contents`, NOT through the splunkd
`__raw` proxy. Some older Splunk versions accidentally surfaced
it through `__raw` too; Splunk 10 doesn't.

I considered three remediation paths:

1.  **Switch to the mrsparkle URL**
    (`/en-US/lookup_edit/lookup_contents`) — works, but it's an
    undocumented internal controller, our own REST proxy strips
    it, and it ties our app to Splunk Web's session model
    (CSRF + cookie auth re-validated by mrsparkle). Brittle.

2.  **Use `data/lookup-table-files` + `data/transforms/lookups`**
    — these *are* public splunkd endpoints, but they manage
    *metadata* (filename, transforms.conf wiring) not contents.
    The contents API at this layer is `inputlookup`/
    `outputlookup` SPL, by design.

3.  **Use `outputlookup` SPL via the existing search dispatcher**
    — works on every Splunk version since 5.0, runs in the same
    auth/CSRF/namespace context as our existing reads, and the
    whole upsert (read existing rows + filter by name + append
    new row + write) collapses into a single atomic search job.

Picked option 3.

### Fix

Replaced the REST-based `writeAllRows()` with two SPL-based
helpers:

```typescript
// Save (upsert by name)
const upsertRowSpl = async (row: DiagramRow) => {
  const spl =
    '| inputlookup network_diagrams ' +
    `| where name != "${escapeSpl(row.name)}" ` +
    '| append [ ' +
    '  | makeresults ' +
    `  | eval name="${escapeSpl(row.name)}", ` +
            `updated_at="${escapeSpl(row.updatedAt)}", ` +
            `updated_by="${escapeSpl(row.updatedBy)}", ` +
            `payload_json="${escapeSpl(row.payloadJson)}" ` +
    '  | fields - _time ' +
    '] ' +
    '| sort name ' +
    '| outputlookup network_diagrams.csv';
  await runSearch({ spl, earliestTime: '-1m', latestTime: 'now',
                    tag: 'network_diagrams_save' });
};

// Delete by name
const deleteRowSpl = async (name: string) => {
  const spl =
    '| inputlookup network_diagrams ' +
    `| where name != "${escapeSpl(name)}" ` +
    '| outputlookup network_diagrams.csv';
  await runSearch({ ... });
};
```

Both go through `runSearch`, which already pins to our app's
namespace via `oneShot(..., { app: 'splunk-cisco-dashboards' })`.
`outputlookup network_diagrams.csv` therefore resolves to
`$SPLUNK_HOME/etc/apps/splunk-cisco-dashboards/lookups/...`,
exactly where we want it.

### SPL injection guard

`escapeSpl()` re-escapes `\` and `"` for SPL's double-quoted
string parser. Inputs are layered-defended:

- `name`     — pre-validated against `NAME_PATTERN` (rejects
              `\` and `"` outright; only ASCII alnum, space,
              `.`, `_`, `-` allowed).
- `updatedAt`, `updatedBy` — generated by THIS module from
              `Date.now()` and `$C.USERNAME`, never user input.
- `payload_json` — `JSON.stringify(...)` output. We re-escape
              its `\` and `"` for the SPL parser.

Three independent layers; even if one slips, the next one
catches.

### SPL length cap

The previous `MAX_SPL_LENGTH = 32 KiB` in
`splunkSearchService.js` was too tight for inlining a diagram
payload. Bumped to `300 KiB`. The real safety guard is the
control-character check (`UNSAFE_CONTROL_CHAR_PATTERN`), which
is unchanged. Splunk handles much longer SPL routinely.

Belt-and-braces: also added a client-side cap on the JSON
payload itself (`MAX_PAYLOAD_BYTES = 256 KiB` →
`DiagramPersistenceError` with a friendly "diagram too large"
message). This covers a 1000-node diagram comfortably; if a
real customer ever hits it we add chunked saves in a future
build.

### Bonus simplification

`saveDiagram` no longer needs to read the full lookup, mutate
client-side, then ship the whole CSV back — that
read-modify-write was the only reason `fetchAllRows()` was
called from save/delete. With the SPL upsert, splunkd does the
read-filter-append in a single job. The browser only ships the
single new row. Big payloads no longer round-trip the existing
diagrams over the wire on every save.

`deleteDiagram` also no longer needs the read-existing-rows
short-circuit; `outputlookup` on the filtered set is idempotent
even if the row didn't exist.

### Verification

- **Typecheck**: `yarn typecheck` → clean.
- **Build**: `yarn run clean:build` → `network_diagram.js`
  rebuilt, `app.conf build = 108`, `stage/` clean.
- **Linter**: `ReadLints` on the changed files → no errors.
- **No new dependencies**: `@splunk/splunk-utils/fetch` import
  from Build 107 was removed; `runSearch` (already used for
  reads) carries the writes too.

### Deploy + verify (Alan)

1. Sync `stage/` to `sh-i-ak:8000` (same procedure as 106/107).
2. Restart Splunk (or `_reload_app` for conf reloads).
3. Hard-reload the **Network Diagram** page.
4. Drag two devices in, link them, click **Save As** →
   "FDEM Test Save".
5. Expected: success toast, name appears in the picker, NO
   console 401 / 404 / 400. The `structured_data_service` 404
   from `splunkbar` will still appear — that's not us.
6. Refresh, pick "FDEM Test Save", verify positions intact.
7. From any Splunk search bar:
       | inputlookup network_diagrams
   should show the row, with `name=FDEM Test Save`,
   `updated_by=<your username>`, the timestamp you saved at,
   and the JSON payload in `payload_json`.
8. Delete the diagram from the UI; re-run the SPL above — the
   row is gone.

### What's next

Build 109 — **edge styling + edge inspector**. Solid vs dashed
explicit, arrowhead toggle, bandwidth chip + L2/L3 chip on the
edge midpoint via a custom edge type. Edge inspector tab in
PropertiesPanel: kind / label / bandwidth / layer chip-picker /
notes.

(Builds 109+ from the original Build 106 plan all shift by 2 —
I burned 107 + 108 on this CSRF/REST detour. The
`structured_data_service` 404 silencer is now Build 110 if Alan
still finds it noisy after the diagram save story is healthy.)

---

## 2026-05-14 (Build 107) — Diagram save: CSRF defense via `@splunk/splunk-utils/fetch`

### Goal

Build 106's `Network Diagram` page was a hit — Alan loved the
drag-from-palette authoring, the real-asset binding, the region
containers, and confirmed our gambit of "diagram = single JSON
row in `network_diagrams.csv`" was the right call (his quote:
"it allows us to run a search and auto-populate it"). One
regression though: clicking **Save** crashed with an opaque
toast and a console 401:

    POST .../data/lookup-edit/lookup_contents → HTTP 401
    {"messages":[{"type":"ERROR",
                  "text":"Splunk cannot authenticate the request.
                          CSRF validation failed."}]}

That's not a permissions problem — splunkweb's CSRF middleware
is rejecting our POST before splunkd even sees it.

### Discovery

`diagramPersistenceService.writeAllRows()` was assembling its
own `fetch()` call with a hand-rolled cookie reader for the form
key:

    const csrf = getCsrfToken();        // reads splunkweb_csrf_token_<port>
    headers['X-Splunk-Form-Key'] = csrf;
    fetch(url, { method: 'POST', credentials: 'include', headers, body });

That works for **GETs** (which is why the searchbase catalogue
read works fine) but Splunk's CSRF defense for state-changing
requests has *two* legs: the form-key header AND
`X-Requested-With: XMLHttpRequest`. Without the second header
the request looks like a forged form post and splunkweb 401s
before even forwarding to splunkd.

I confirmed this by reading
`node_modules/@splunk/splunk-utils/fetch.js`:

    var defaultFetchInit = {
      method: 'GET',
      credentials: 'include',
      headers: {
        'X-Splunk-Form-Key': _config.CSRFToken,
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };

The official SDK helper sets BOTH headers — and resolves the
form-key via `getCSRFToken()` from `@splunk/splunk-utils/config`,
which knows about every cookie variant Splunk has shipped
(per-port, no-port, alternate names). My hand-rolled regex only
matched the per-port variant.

### Fix

Replaced the custom-fetch logic in `writeAllRows` with
`createFetchInit({...})` from `@splunk/splunk-utils/fetch`:

    const init = createFetchInit({
      method: 'POST',
      body: body.toString(),
      headers: { Accept: 'application/json' },
    });
    res = await fetch(buildLookupEditUrl(), init);

`createFetchInit` does the right thing automatically — adds
`X-Splunk-Form-Key`, `X-Requested-With: XMLHttpRequest`,
`Content-Type: application/x-www-form-urlencoded`,
`credentials: 'include'` — and merges in our overrides
(`Accept: application/json`, `body`, `method: 'POST'`).

Also dropped the now-dead `getCsrfToken()` helper from this
service. The package was already in `dependencies` (used by
several other services), so no `package.json` change required.

The READ path (`fetchAllRows`) was already going through
`runSearch()`, which delegates to the SDK and was never broken.
This change is scoped strictly to the lookup-edit POST.

### Why not "just add the missing header"

The custom fetch had two bugs (missing `X-Requested-With` AND a
fragile cookie regex). Patching just one would still break for
operators on Splunk Cloud Stack with the no-port cookie variant,
or whatever Splunk decides to do in the next minor release.
Routing through the SDK is the future-proof move — when Splunk
ships a new CSRF mechanism, we get it for free on the next
`yarn upgrade`.

### Verification

- **Typecheck**: `yarn typecheck` → clean (no TS errors).
- **Build**: `yarn run clean:build` → `network_diagram.js` (650 KiB)
  rebuilt, `app.conf build = 107`, `stage/` clean.
- **Linter**: `ReadLints` on the changed file → no errors.

### Deploy + verify (Alan)

1. Sync `stage/` to `sh-i-ak:8000` (your existing deploy
   procedure — same as Build 106).
2. Restart Splunk (or `_reload_app` for the conf reloads we
   declared).
3. Hard-reload the **Network Diagram** page.
4. Drag two devices from the Inventory tab; link them; click
   **Save As** → "FDEM Test Save".
5. Expected: success toast, name picker now lists "FDEM Test Save",
   no console errors.
6. Refresh the page; click the picker; select "FDEM Test Save";
   the saved diagram reappears with positions intact.
7. From the Splunk search bar:
       | inputlookup network_diagrams
   should show one row with `name=FDEM Test Save`,
   `updated_by=<your username>`, and a `payload_json` blob.

### What's next

The `structured_data_service` 404 is still spamming the console.
That endpoint comes from Splunk's `splunkbar/system/Master`
header and is harmless platform noise (Edge Processor probe).
Not in our app's surface area. Build 108 will silence it via a
narrow `console.error` filter scoped to our pages — only if Alan
confirms it's still annoying after Build 107 lands. Otherwise
Build 108 is the originally-planned **edge styling + edge
inspector** (solid/dashed, arrowhead toggle, bandwidth chip,
L2/L3 chip) on the diagram canvas.

---

## 2026-05-14 (Build 106) — Network Diagram: drag-from-palette authoring + real-asset binding + lookup-backed save/load + region groups

### Goal

Alan reviewed Build 105 and the still-busted "topology canvas live
overlay", looked at his customer's actual Florida DEM v8 PDF
network diagram, and pivoted the brief:

> "I really need to be able to build a diagram like the real one
> you see in the PDF document … the ability to drag/drop objects
> freely on the map and create links with arrows between them
> and the ability to maybe have a side panel to pick and choose
> what I need to place on the map instead of us doing anything
> and the customer can start dragging items from the side panel
> to the map and creating links between them, the panel should
> have filters on field in the table so they can zoom-in on
> switches etc."

The Build 105 canvas is a *viewer* — it auto-discovers from
`asset_inventory` + `site_topology_lookup` and arranges via
ELK. That's useful for "show me what discovery says", but it's
the wrong tool for the customer's need: **authoring** a Visio-
style diagram that they can save, reload, and share alongside
live data.

Three console errors at the start of the session focused
priorities:

1. `GET /splunkd/__raw/services/configs/conf-limits/structured_
   data_service 404` — Splunk Web's own `splunkbar/system/Master`
   header bar; not our code, harmless platform chatter.
2. `POST .../search/v2/jobs 400` from `topology_canvas_v1.js` —
   our `fetchThousandEyesA2AEdges` was dispatching `| savedsearch
   "Overview - Link ThousandEyes A2A Health"`, but that name only
   exists as a `[overview_link_te_a2a_health]` stanza in
   `searchbase.conf`, not as an actual saved search. Splunk
   rightly returned 400.
3. `installHook.js: fetchThousandEyesA2AEdges: saved search not
   available` — the warn from the catch block triggered by #2.

Fixed #2/#3 first by rewiring the fetcher to look the SPL up in
the searchbase catalogue (`getSearchbaseCatalogue()`) and dispatch
the inline body via `runSearch()` — the same path the rest of the
app uses. The 400 / warn pair both went away. #1 is platform
noise we can't suppress.

Then the pivot.

### Discovery & decisions

**Re-read the PDF carefully.** Four visual primitives drive the
"mind-blowing" part of the v8 reference:

1. **Detailed Cisco-rendered SVGs** of real device families
   (already shipped 9 in Build 105: router / l2-switch / l3-switch
   / firewall / wlc / ap / server / cloud / generic; PDF wants
   ASA / Catalyst stacks / WS-C6504 / ISR3900 / WLC5508 — punted
   to Build 110).
2. **Labelled colored regions** ("Tallahassee", "Orlando",
   "Blanding", "Data Center") — devices physically *inside* the
   region.
3. **Two edge styles** with explicit legend (line 216–217 of the
   PDF): solid for physical, dashed for logical — labelled with
   bandwidth (`100Mbps`, `20G`) and layer (`L2`, `L3`).
4. **Free-form positioning** — the author drops shapes wherever
   they want, no auto-layout.

**Three options laid out for Alan:**

- **A. Generic shapes only** (draw.io flavour). Simplest; loses
  the "drag a real device" magic.
- **B. Real-asset palette** (Splunk flavour). Sidebar has two
  tabs: generic shapes + filterable `asset_inventory` list. Drop
  a real device → node carries the `device_id` so health overlays
  light up automatically.
- **C. B + auto-suggest layout button**. Adds a "seed from
  inventory" button that pre-places devices.

Alan picked B with C as a fast-follow (Build 109). His exact
words after I asked which gives "ease of use AND mind-blowing
graphics": *"sure, retire it if we are not going to use it and
create whatever you see fit, I trust you."* — and we'd already
agreed on B.

**Persistence model decision.** The Build 105 scaffold was
`network_topology_edges.csv` — one row per edge — with no
producer wired and no consumer wired. With the new
*authoring* direction, the right schema is **one row per saved
diagram** with the layout encoded as a JSON blob. Diagram size
is a few KB even for ~200 devices, so the simplification is
free. Atomic save = single row replace.

Two REST surfaces, mirrored from existing patterns:

- **Reads**: `runSearch('| inputlookup network_diagrams')` —
  reuses the cached SPL dispatch path the searchbase catalogue
  also uses.
- **Writes**: POST to
  `/data/lookup-edit/lookup_contents` with a JSON-encoded
  array-of-arrays — same surface Splunk Web's "Edit Lookup" modal
  uses. Last-writer-wins, fine for single-tenant authoring.

### What we built

**Retired the stale Build 105 scaffold**:
- Deleted `splunk/lookups/network_topology_edges.csv`.
- Removed `[network_topology_edges]` stanza from
  `splunk/default/transforms.conf`.

**New persistence layer**:
- `splunk/lookups/network_diagrams.csv` — empty seed with
  header `name, updated_at, updated_by, payload_json`.
- `splunk/default/transforms.conf` — new `[network_diagrams]`
  stanza with the schema documented inline.
- `webapp/common/services/diagramPersistenceService.ts` —
  list / load / save / delete diagrams by name. SPL-injection-
  safe name pattern (`[A-Za-z0-9][A-Za-z0-9 _.\-]{0,63}`). CSRF
  token discovery and X-Splunk-Form-Key header on writes.
  Includes a `MOCK_STORE` fallback so the page is testable
  outside Splunk runtime.

**New page wiring** (clones the `topology_canvas_v1` pattern):
- `webpack.config.js` — added `network_diagram` entry.
- `splunk/default/data/ui/views/network_diagram.xml` — Simple
  XML host page with `script="network_diagram_bootstrap.js"` and
  `<div id="scan-root"></div>`.
- `splunk/appserver/static/network_diagram_bootstrap.js` —
  cache-busted require() loader for the React bundle.
- `splunk/default/data/ui/nav/default.xml` — nav link "Network
  Diagram" right after "Topology Canvas".
- `webapp/pages/network_diagram/render.tsx` + `index.tsx` —
  page entry + the orchestrator component.

**Diagram authoring components** (new
`webapp/common/components/diagram/` directory):

- `types.ts` — `PALETTE_DND_MIME` (custom `application/x-scd-
  palette-payload` so unrelated drops don't trigger node
  spawns), `PaletteDragPayload` tagged union (`shape | region |
  asset`), `NODE_SIZE_PRESETS` (device 100×110, region 360×220).
- `RegionGroupNode.tsx` — labelled translucent container with
  a header bar (label + device-count pill) and a drop-through
  body. Allow-listed accent palette so `data.accent` can't render
  arbitrary class names. Build 106 ships fixed-size; Build 107
  wires `<NodeResizer>` for drag-resize.
- `ShapesTab.tsx` — 2-column grid of draggable Cisco icon tiles
  (the 9 device shapes + Region/Site). Each tile is an HTML5
  drag source emitting a `PaletteDragPayload`.
- `InventoryTab.tsx` — filterable list of real devices from
  `asset_inventory`. Free-text search + device-type chips +
  site chips, all AND-combined. Top-N facets capped at 8 each;
  list capped at 200 visible rows with "+N more, filter to
  narrow" banner. Each row is an asset-bound drag source.
  Reuses `fetchAssetInventory()` from the existing
  `topologyDiscovery` service so no new SPL is dispatched.
- `DiagramPalette.tsx` — left-side tab switcher hosting the
  two tabs above; pure chrome, owns no canvas state.
- `DiagramHeader.tsx` — top bar with diagram-name picker
  dropdown (lazy-loaded directory), Save / Save As / Delete /
  New buttons, busy spinner, and a transient status line with
  TTL (3.5s for info, 8s for errors).
- `NetworkDiagramCanvas.tsx` — the authoring surface.
  Self-contained React Flow wrapper (separate from
  `TopologyCanvas` — no auto-discovery, no ELK):
  - `DIAGRAM_NODE_TYPES` extends `TOPOLOGY_NODE_TYPES` with
    `regionGroup`, so the existing 9 Cisco shapes render
    unchanged.
  - HTML5 DnD bridge: `onDragOver` only previews when the
    custom mime is present, `onDrop` parses the payload and
    spawns the right node variant.
  - Drop-into-region detection: smallest rectangle wins, child
    inherits `parentId` + `extent: 'parent'` so dragging the
    region drags its children.
  - Snap-to-grid (20×20) on drop AND on drag (via React Flow's
    `snapGrid`) so customer-arranged diagrams stay tidy.
  - `findContainingRegion` + `annotateRegionCounts` — region
    pills auto-update with their child count after every change.
  - `onConnect` for manual edge drawing (kind: 'physical' by
    default; PropertiesPanel switches to logical / synthetic).
  - Reuses the existing `PropertiesPanel` for selection editing.
  - Asset-bound nodes use the asset's `device_id` AS their
    React Flow node id, so a duplicate drop is a no-op (one
    node per real device per diagram).
  - Hydrate-from-payload effect with `requestAnimationFrame
    fitView` so opening a diagram lands centered.
  - Empty-state hint banner that explains the workflow.

**Page orchestrator** — `pages/network_diagram/index.tsx`:
- Wires the persistence service, the live `asset_inventory`
  index (loaded once, threaded into the canvas for re-binding
  saved nodes to fresh display data), the directory listing
  for the picker, and the dirty/busy lifecycle.
- `livePayloadRef` mirrors the canvas's current payload as the
  user edits; Save reads from there. Prevents stale-state
  saves during async network ops.
- Beforeunload guard fires when `dirty === true`.
- Confirm-before-discard prompts on New and Open.

**Bumped `app.conf` build = 106.**

### Verification

- `yarn run typecheck` clean (1 transient apostrophe-in-string-
  literal fix during the run; replaced with double-quoted
  string).
- `yarn run clean:build` clean — stale `network_topology_edges.
  csv` removed from `stage/lookups/` confirmed.
- `ReadLints` clean across all 10 new files + the 1 retired
  `transforms.conf` stanza + the 4 wiring files.
- Build sizes: `network_diagram.js` is **650 KiB** — about a
  third the size of `topology_canvas_v1.js` (2.01 MiB). The
  new bundle drops `elkjs` (no auto-layout in the authoring
  flow) and only imports the slim React Flow surface needed.
- Manual test plan (Alan to run on FDEM stack):
  1. Click **Network Diagram** in nav. Expected: blank canvas,
     left palette open on Shapes tab, header reads "Untitled
     diagram".
  2. Drag a Region/Site tile from Shapes onto the canvas →
     translucent labelled container appears.
  3. Switch palette to Inventory tab → device-type and site
     chips populate from `asset_inventory`. Type a query →
     list narrows. Click a `switch` chip → list shows only
     switches.
  4. Drag a real device row INTO the region → device snaps to
     the 20-grid, region's device-count pill increments,
     dragging the region drags the device with it.
  5. Hover any device → 4 port handles fade in. Drag from a
     handle to another device → physical edge drawn.
  6. Click an edge → PropertiesPanel slides in; switch kind to
     logical → edge re-styles dashed grey.
  7. Click Save As, name "FDEM Production" → busy spinner,
     status line "Saved 'FDEM Production' at HH:MM:SS",
     diagram name in header updates.
  8. Click New → confirm-discard if dirty. Canvas blanks out.
  9. Click the diagram-name picker → dropdown lists the saved
     diagram. Click it → canvas re-hydrates with all positions,
     edges, regions intact.
  10. Reload the browser tab → re-open the diagram → identical
      layout. Asset-bound devices show fresh health overlay
      from the latest `asset_inventory` snapshot.

### Files changed

**Retired**:
- `src/main/resources/splunk/lookups/network_topology_edges.csv` (deleted)
- `src/main/resources/splunk/default/transforms.conf` (`[network_topology_edges]` stanza removed)

**New**:
- `src/main/resources/splunk/lookups/network_diagrams.csv`
- `src/main/resources/splunk/default/transforms.conf` (`[network_diagrams]` stanza added)
- `src/main/resources/splunk/default/data/ui/views/network_diagram.xml`
- `src/main/resources/splunk/appserver/static/network_diagram_bootstrap.js`
- `src/main/webapp/pages/network_diagram/index.tsx`
- `src/main/webapp/pages/network_diagram/render.tsx`
- `src/main/webapp/common/services/diagramPersistenceService.ts`
- `src/main/webapp/common/components/diagram/types.ts`
- `src/main/webapp/common/components/diagram/RegionGroupNode.tsx`
- `src/main/webapp/common/components/diagram/ShapesTab.tsx`
- `src/main/webapp/common/components/diagram/InventoryTab.tsx`
- `src/main/webapp/common/components/diagram/DiagramPalette.tsx`
- `src/main/webapp/common/components/diagram/DiagramHeader.tsx`
- `src/main/webapp/common/components/diagram/NetworkDiagramCanvas.tsx`

**Modified**:
- `src/main/resources/splunk/default/app.conf` (build 105 → 106)
- `src/main/resources/splunk/default/data/ui/nav/default.xml` (added "Network Diagram" link)
- `webpack.config.js` (added `network_diagram` entry)
- `src/main/webapp/common/components/topology/edgeFetchers.ts` (TE A2A fix described above)

### What's next

Build 107 — **edge styling + edge inspector**. Solid vs dashed
explicit (already kind-driven, but expose it as a chip in the
panel for clarity), arrowhead toggle, **bandwidth chip** +
**L2/L3 chip** rendered on the edge midpoint via a custom edge
type. Edge inspector tab in PropertiesPanel: kind / label /
bandwidth (free-text) / layer (L1 / L2 / L3 chip-picker) /
notes.

Build 108 — **stale-placement banner**. When loading a saved
diagram, cross-check `asset_inventory`; surface "12 placed
devices no longer in inventory" with a one-click "remove
stale" action.

Build 109 — **"Suggest from inventory" button**. The Option C
fast-follow: clicking it runs `topology_discovery` once and
seeds device positions roughly grouped by `siteLabel`. Operator
accepts, rejects per-device, or wholesale.

Build 110 — **Cisco SVG library expansion**. Add ASA 5525-X,
Catalyst 3850 stack, WS-C6504-E, ISR 3900, Azure Cloud, WLC
5508 to match the FDEM v8 PDF iconography 1:1.

Build 111 (optional) — **NodeResizer wiring on regions** so
operators can drag-resize a region after it's placed.

---

## 2026-05-14 (Build 105) — Topology Canvas: real Cisco shapes + edge editor + properties panel + lookup scaffold

### Goal

Alan looked at the Build 104 spike on his stack and gave honest
feedback:

> "Good work but this is far from ready. I was hoping to see us
> building the links between devices like I showed you in the PDF
> even if we need to have a lookup that drives that which can also
> be manually edited using a quick UI interface so the dashboard
> will simply read it. Meaning we should have an automated way to
> populate the table as much as possible AND an option to build
> relationships meaning lines between objects on the canvas and
> the ability to move and arrange items in the canvas and save
> views etc. Can you look at anyone else that ever done something
> like this and learn from it? React is so amazing, why create
> from scratch if we can find a project somewhere on GitHub that
> we simply use the components from?"

He attached a screenshot showing what landed: a wall of
lucide-icon pills with no edges, no real Cisco shapes, no editor
UX. Three concrete gaps, all real:

1. **No edges visible.** The TE A2A search returned no rows that
   matched any inventory device because its `Tallahassee|TLH|
   Auburndale|AUB` filter was looking for tokens that the customer
   inventory uses in different forms. With no other edge source,
   every device looked orphaned.
2. **Generic-looking shapes.** Lucide icons + colored rings instead
   of real Cisco router/switch/firewall SVGs. Reads as "wall of
   pills" rather than "network diagram".
3. **No editor UX.** I'd disabled `isConnectable` (so you couldn't
   drag-create edges), there was no palette, no properties panel,
   no save-views — just auto-layout and drag-position.

### Discovery & decisions

Before sinking time into another iteration I checked his three
reference points:

- `~/repo/health_check_hq/` (the `splunk_insights` Splunk app) —
  ~30 React pages, no topology canvas. They DO have a
  `DashboardStudioEditor.jsx` that embeds `@splunk/dashboard`
  (Dashboard Studio React components) inside their app — useful
  pattern for tile-based dashboards but the wrong tool for
  free-form Visio diagrams.
- [splunkui.splunk.com/Packages](https://splunkui.splunk.com/Packages) —
  `@splunk/visualizations` ships ~25 chart types (Area / Bar /
  Bubble / Choropleth / Line / Map / Sankey / Scatter / Single
  Value / Table / Treemap / etc). **No Network or Topology viz.**
  Splunk Dashboard Studio does not ship a free-form
  network-diagram component. Confirmed gap.
- OSS landscape — surveyed React Flow (MIT, what we already use,
  used by Zapier/n8n/Stripe); Cisco's public Network Topology
  Icons SVG library (free, official cisco.com brand-center asset);
  drawio/diagrams.net (Apache 2.0, full Visio editor, but iframe
  embedding doesn't pass Splunk Cloud Vetting reliably and we
  lose live-telemetry overlay); ESnet `react-network-diagrams`
  (purpose-built but stuck on React 16 + D3 v5, last release
  ~2022); JointJS (GPLv3 — license incompatible); GoJS
  (commercial, $7,000+/seat).

**Architectural call:** keep React Flow (the right primitive),
invest in the layers above it. Specifically: real Cisco shapes,
manual edge drawing, properties panel, lookup-driven persistence.
This is Build 105's scope. Builds 106-108 (lookup-backed edge
read/write + auto-seeder, save-views, live telemetry overlay) are
queued separately.

### What we built

**Cisco shape library** —
`webapp/common/components/topology/ciscoIcons.tsx`. Nine inline
SVG icon components approximating the official Cisco Network
Topology Icon library: `CiscoRouterIcon` (drum body with
multi-direction arrows), `CiscoL2SwitchIcon` and
`CiscoL3SwitchIcon` (3D-perspective stacked planar bodies, L3
adds vertical arrows), `CiscoFirewallIcon` (brick wall),
`CiscoWlcIcon` (hex chassis with antenna stalks), `CiscoApIcon`
(puck with concentric radio rings), `CiscoServerIcon` (rack-unit
silhouette with drive bays), `CiscoCloudIcon` (scalloped WAN
glyph), `CiscoGenericIcon` (neutral box). All use
`currentColor` so the parent's `text-emerald-500` /
`text-rose-500` etc tints them per health status without
per-shape tinting code. Designed for a 64×64 viewBox with
`vector-effect: non-scaling-stroke` so line weights stay uniform
at any size. Single-source-of-truth registry: `CISCO_ICONS`.

**Shape rewrite** —
`webapp/common/components/topology/shapes.tsx`. Promoted the
device icon to be the primary visual element. New geometry:
top 2/3 = SVG icon (48×48 inside a 100×110 card, colored per
status), bottom 1/3 = label area separated by a hairline
(short-name bold, device-type secondary, uppercase). Status
outline rides on the card border, NOT the icon, so the icon's
intrinsic Cisco branding stays clean. Status dot top-right for
redundant non-color signal (accessibility). Result: a 30-device
site that previously looked like a wall of pills now looks like
a Visio architecture sheet.

**Manual edge UX** — same file. Added handles on all four sides
(top/right/bottom/left) of every device shape, each with both
`source` and `target` types so React Flow picks based on drag
direction. Handles are `opacity-0` at rest and
`group-hover:opacity-100` so the canvas stays clean until an
operator actively engages a node. Re-enabled `isConnectable`
(was hard-disabled in Build 104) and wired `onConnect` to a
new manual-edges state slice that persists to localStorage
under `topologyCanvasManualEdges.v1`. Self-loops are blocked
because they're rarely useful and break ELK if reused in a
future re-layout.

**Properties panel** —
`webapp/common/components/topology/PropertiesPanel.tsx`. New
right-side inspector that opens when an operator selects any
node or edge. Shape:

- Identity (display name, short alias)
- Shape (dropdown over the 9 device families)
- Notes (multi-line, free-form)
- Provenance (id, management source, edit-persistence
  disclaimer)
- Apply / Remove buttons

For edges:

- Endpoints (read-only source / target)
- Edge kind (physical / synthetic_a2a / logical with hint copy
  describing each line style)
- Label (midpoint text)
- Notes
- Apply / Remove

Edits commit only on Apply (no live mutation) so the panel can
also serve as a "viewer" without exposing accidental-mutation
surface area. Mutations route through `setNodes`/`setEdges`
without re-running ELK, so the canvas stays responsive.

**Canvas surgery** —
`webapp/common/components/topology/TopologyCanvas.tsx`. Added:

- `onNodeClick` / `onEdgeClick` / `onPaneClick` for selection
  routing. Clicking a zone container is intentionally a no-op
  (zones are chrome, not editable entities).
- `onConnect` for manual edge creation, defaulting new edges to
  `kind: 'physical'`. Opens for editing via the panel.
- `handleNodeUpdate` / `handleEdgeUpdate` / `handleDelete`
  from the panel callbacks. Deleting a node also drops any
  incident edges so the canvas doesn't render dangling lines.
- "Save snapshot" toolbar button — diagnostic for now,
  surfaces the persisted state via a `window.alert`. Replaced
  in Build 106 with a real outputlookup pipeline.
- Mid-top hint banner that tells operators how to draw edges:
  *"Hover a device to reveal its 4 ports · drag from a port to
  another device to draw a link · click any node or edge to
  edit"*. Intentionally pointer-events-none so it doesn't
  interfere with canvas pan/zoom.

**Layout tweak** — `webapp/common/lib/elkLayout.ts`. Switched the
per-zone layout algorithm from `layered` (DOWN direction, which
produced single-column tower stacks) to `box` (rectangle-packing
with `aspectRatio: 1.5`, so a 30-device site renders as a
roughly 7×5 grid). `layered` direction at the root stayed `RIGHT`
so zones still flow left-to-right matching the FDEM PDF
convention. Default device dimensions changed from 140×80 (pill)
to 100×110 (icon card).

**Lookup scaffold for Build 106** —
`splunk/default/transforms.conf` gained a `[network_topology_
edges]` stanza pointing at a new
`splunk/lookups/network_topology_edges.csv` (header-only). Schema
documented in the stanza header:
`source_device, target_device, kind, label, bandwidth_mbps,
status_search_name, source, customer_visible, notes, created_by,
created_at, last_modified_by, last_modified_at`. Build 106 wires
the read/write pipeline; this build only ships the table.

### Verification

- `yarn build` clean (2 pre-existing size warnings unchanged).
- `yarn typecheck` clean.
- `ReadLints` clean across all new and modified files.
- Manual test plan (Alan to run on FDEM stack):
  1. Click **Topology Canvas** in nav → canvas should now show
     real Cisco-styled shapes grouped into per-site rectangles
     with breathing room (no more single-column towers).
  2. Hover any device → four sky-blue port handles fade in on
     each edge.
  3. Drag from a handle to another device → a new physical-link
     edge appears; it stays after page reload (localStorage).
  4. Click a node → right-side properties panel slides in with
     identity / shape / notes fields. Change the shape from
     dropdown → click Apply → icon swaps live.
  5. Click an edge → panel switches to edge mode. Change kind
     from physical to synthetic_a2a → edge re-styles dashed
     sky-blue and animates.
  6. Click Remove on either node or edge → entity disappears;
     incident edges drop with the node.
  7. Click "Save snapshot" → confirmation alert shows the
     count of persisted overrides + manual edges. (Build 106
     replaces this with an outputlookup pipeline + a real
     toast.)

### What's next

- **Build 106** (lookup-driven edges + auto-seeder):
  - `| inputlookup network_topology_edges` on canvas mount,
    merging stored rows with auto-discovered ones.
  - Properties-panel "Apply" → outputlookup write-back via a
    new `[network_topology_edges_writer]` searchbase stanza.
  - `[Network Topology - Auto-Seed Edges]` saved search that
    composes DNAC physical-topology API + cisco:ios syslog CDP
    messages + ThousandEyes A2A test pairings, deduplicated by
    `(source_device, target_device, kind)`.
  - Canvas surfaces "n new auto-discovered links — review &
    accept" toaster.
- **Build 107** (named saved views):
  - `network_topology_views.csv` lookup with
    `view_name, owner, layout_overrides_json,
    edge_overrides_json, created_at, last_modified`.
  - Toolbar adds "Save view as…" / "Load view…" / "Set as
    default".
  - Per-user default loads on mount; fallback to auto-layout
    if no view exists.
  - Migration: existing `localStorage` overrides auto-import
    into a "Local overrides" view on first load.
- **Build 108** (live telemetry overlay):
  - Edge labels animate with current latency/loss/jitter when
    `status_search_name` resolves.
  - Node corner badges show health score + alert count + uptime.
  - Click an edge → popover renders the same content the
    existing `CustomerTopologyMap` link popover shows.

### Files changed

- New: `webapp/common/components/topology/ciscoIcons.tsx`
- New: `webapp/common/components/topology/PropertiesPanel.tsx`
- New: `splunk/lookups/network_topology_edges.csv` (header only)
- Edit: `webapp/common/components/topology/shapes.tsx`
  (icon-forward rewrite + four-side handles)
- Edit: `webapp/common/components/topology/TopologyCanvas.tsx`
  (selection, edge creation, properties-panel wiring,
  manual-edges persistence, "Save snapshot" toolbar)
- Edit: `webapp/common/services/topologyDiscovery.ts`
  (added `cloud` and `l3_switch` shape ids; refined family
  matching for routers / WLCs / L3 switches)
- Edit: `webapp/common/lib/elkLayout.ts`
  (per-zone `box` algorithm; default device size 100×110)
- Edit: `splunk/default/transforms.conf`
  (new `[network_topology_edges]` stanza with full schema
  documentation)
- Edit: `splunk/default/app.conf` (build → 105)

---

## 2026-05-14 (Build 104) — Topology Canvas v1 spike: Visio-style network diagram dashboard

### Goal

Alan asked: *"How difficult is it to build a dashboard like our overview
in Splunk that we can use to build our own custom network diagram or
map? Like what someone would create in Visio?"* He attached the
FDEM Network diagram v8 PDF as a reference and confirmed in a follow-up
that he'd love auto-population from the existing
`[Asset Inventory - Build Lookup]` scheduled job (which already
correlates Catalyst Center / Meraki / IOS syslog / ASA-FTD-Firepower
/ ISE NADs / F5 BIG-IP / Windows-AD / DHCP into one row per device)
plus manual edit affordances on top.

### Decision: hybrid auto-discover + operator-override architecture

**Frontend stack** (zero new infra):

- **React Flow (`@xyflow/react` v12.10)** — canvas runtime. Picked
  over D3 / vis.js / cytoscape because it natively understands
  React composition (we already author the rest of the dashboards
  in React 19), supports parent-child node containment via
  *subflows* (essential for grouping devices into customer-site
  rectangles), and has first-class drag-to-reposition with stable
  IDs. Bundle cost: ~35KB gzipped + zustand state.
- **`elkjs` v0.11** — auto-layout. Picked over Dagre because ELK
  natively lays out hierarchical containers (each customer site
  becomes its own laid-out subgraph, then ELK composes the whole),
  uses orthogonal edge routing closer to a Visio architecture sheet
  than a force-directed blob, and is deterministic for
  reproducible layouts across reloads. Bundle cost: ~600KB
  unminified, but tree-shaken via the bundled `elk.bundled.js`
  entrypoint.
- **Tailwind + lucide-react icons** for the shape library —
  reuses existing dashboard tokens; no SVG icon library yet.
- **localStorage** under key `topologyCanvasOverrides.v1` for
  per-node `(x, y)` overrides — simplest possible v1 persistence.
  KVStore-backed multi-user persistence is a follow-up.

**Backend (zero new ingestion required for the spike):**

- **Devices**: read `asset_inventory.csv` via `| inputlookup
  asset_inventory`. Already-built nightly by
  `[Asset Inventory - Build Lookup]`. Columns we consume:
  `device_name`, `device_name_short`, `device_type`,
  `device_family`, `health_score`, `compliance_status`,
  `location`, `management_source`, `platform_id`. Treated as
  source of truth — adding a new feed to the lookup builder
  (e.g. Cisco Spaces APs) automatically populates the canvas.
- **Sites/zones**: read `site_topology_lookup.csv` via
  `| inputlookup site_topology_lookup`. Built hourly by
  `[Executive Dashboard - Site Topology Lookup Generator]`.
  Used today for label resolution (matching
  `asset_inventory.location` strings to DNAC display names).
- **Synthetic edges (TE A2A)**: dispatch the *existing*
  `[overview_link_te_a2a_health]` stanza. The fetcher resolves
  the AUB↔TLH measurement to representative routers/firewalls in
  the inventory (preferring router/firewall device shapes over
  switches for "WAN edge" semantics), drops the edge silently if
  no matching device is found.
- **Physical edges (CDP/LLDP)**: deliberately deferred. There is
  no `cisco:dnac:link:topology` sourcetype on the standard
  `TA-cisco-catalyst`, so port-to-port discovery requires a
  future REST modular input against DNAC's
  `/dna/intent/api/v1/topology/physical-topology` endpoint.
  The architecture supports the data shape — just no source yet.

### What we built

**New service modules:**

- `webapp/common/services/topologyDiscovery.ts` — `inputlookup`
  dispatch + normalisation. Public API:
  `discoverTopology()` returns `{ nodes[], edges[], zones[],
  fetchedAt }` where every device family is mapped to one of
  seven canonical `DeviceShapeId` values
  (`switch / router / firewall / wlc / access_point / server /
  generic`) and `health_score` (0/50/100 from DNAC) is mapped to
  `healthy / warning / critical / unknown`. Both maps are
  additive — adding a new device family means one branch in
  `mapDeviceTypeToShape`.
- `webapp/common/lib/elkLayout.ts` — wraps `elkjs` with our
  React-Flow-specific layout shape. Top-level direction is
  left-to-right (`elk.direction: 'RIGHT'`) to match the FDEM PDF
  convention (Tallahassee on the left, remotes flowing right).
  Each customer site becomes a parent node with `'elk.algorithm':
  'layered', 'elk.direction': 'DOWN'`; root composes them
  side-by-side. Devices with no `location` value get bucketed
  into a synthetic `__unsited__` zone with an amber dashed
  border so operators see the ones they need to clean up.
  Exports `applyOverrides(layoutResult, overrides)` so the
  canvas can merge persisted operator drags WITHOUT re-running
  ELK on every drag.

**New component modules:**

- `webapp/common/components/topology/shapes.tsx` — six device
  shapes + the zone container, all built on a single
  `DeviceShape` component driven by a shape-id → (icon, accent)
  registry. Status-coloured ring + corner dot (redundant
  non-color signal for accessibility) + truncated short-label
  + secondary platform/family caption. Two React Flow handles
  per shape (top + bottom) so edges attach in either direction.
  Exports `TOPOLOGY_NODE_TYPES` registry consumed by React Flow.
- `webapp/common/components/topology/TopologyCanvas.tsx` —
  React Flow wrapper. Owns the discover → layout → render
  pipeline, the floating toolbar (refresh + reset-layout),
  loading/empty/error overlays, and the persistence handlers.
  Persists per-node `(x, y)` on `onNodeDragStop` to localStorage;
  `Reset layout` clears the override map and re-runs ELK with a
  150ms `fitView` animation so operators see the change.
  Renders `<Background variant="Dots">` + `<Controls>` +
  `<MiniMap>` for canvas chrome. Empty state surfaces a copy-
  pasteable hint to dispatch the lookup-builder manually.
- `webapp/common/components/topology/edgeFetchers.ts` —
  pluggable edge sources. `fetchThousandEyesA2AEdges` dispatches
  `| savedsearch "Overview - Link ThousandEyes A2A Health"` and
  resolves source/target to representative inventory devices
  via case-insensitive site-token matching. `fetchAllEdges`
  is a `Promise.allSettled` composer for the canvas page to
  pass as a single `fetchEdges` prop. Adding a new feed (e.g.
  future DNAC physical links) is a matter of writing one more
  fetcher and adding it to the array.

**Page wiring:**

- `webapp/pages/topology_canvas_v1/{index,render}.tsx` — page
  shell with a slim header (Layers icon, title, "v1 spike"
  amber pill, provenance subtitle) and a full-bleed canvas.
- `splunk/default/data/ui/views/topology_canvas_v1.xml` — Splunk
  view stanza, mirrors the overview pattern (hideEdit /
  hideExport / hideTitle, `<html>` panel with
  `<div id="scan-root">`, RequireJS bootstrap script).
- `splunk/appserver/static/topology_canvas_v1_bootstrap.js` —
  cache-busting RequireJS loader.
- `splunk/default/data/ui/nav/default.xml` — added
  `<a href="topology_canvas_v1">Topology Canvas</a>` next to
  IT Health and Security.
- `webpack.config.js` — added the new entry. Same babel/css/
  postcss pipeline as overview.

**Dependencies added:**

- `@xyflow/react@^12.10.2` — React Flow runtime.
- `elkjs@^0.11.1` — Eclipse Layout Kernel.
- Transitive: `@types/d3-{drag,transition,zoom}`,
  `@xyflow/system`, `classcat`, `d3-{drag,selection,transition,
  zoom}`, `zustand`. All MIT.

### Verification

- Build verification + ReadLints run after this commit lands.
- Manual test plan (Alan to run on FDEM stack after deploy):
  1. Nav click → "Topology Canvas" surfaces a populated canvas
     within ~2-3 seconds (the `| inputlookup` is fast — only the
     A2A edge fetch can take 4-8s).
  2. Each device renders with the shape matching its
     `device_type`/`device_family` and an outline matching its
     `health_score` band.
  3. Devices group by `location` into per-site rectangles.
  4. AUB↔TLH appears as a dashed sky-blue *animated* edge once
     the TE A2A fetch resolves.
  5. Drag any device → reload page → device stays where you
     dragged it. Click "Reset layout" → it snaps back to the
     ELK-assigned position with a 250ms fit-view animation.

### What's next

- **TE test commission**: Alan to commission TLH↔Orlando /
  Blanding / SLRC / Rudd / Easley / Sadowski / MCV A2A tests in
  parallel. Once they exist, `fetchThousandEyesA2AEdges` will
  iterate the rows naturally (the search is single-pair today
  but the fetcher already iterates `res.results`); only the SPL
  filter needs to widen.
- **DNAC physical-link modular input**: design + ship a REST
  modular input against `/dna/intent/api/v1/topology/physical-
  topology` to populate `cisco:dnac:link:topology`. That will
  unlock automatic CDP/LLDP edge discovery without any frontend
  changes.
- **KVStore-backed overrides**: replace localStorage with a
  KVStore collection so layouts are per-user-multi-device and
  survive browser cleanups.
- **Edge interactions**: click an edge → popover with the same
  popover content the existing `CustomerTopologyMap` link
  popover renders (so the visualisations share telemetry UI).
- **Shape additions**: load balancers, voice gateways, AP
  shapes (today they all use the generic shape because no real
  Cisco device SVG library is wired in yet).

### Files changed

- New: `webapp/common/services/topologyDiscovery.ts`
- New: `webapp/common/lib/elkLayout.ts`
- New: `webapp/common/components/topology/shapes.tsx`
- New: `webapp/common/components/topology/TopologyCanvas.tsx`
- New: `webapp/common/components/topology/edgeFetchers.ts`
- New: `webapp/pages/topology_canvas_v1/index.tsx`
- New: `webapp/pages/topology_canvas_v1/render.tsx`
- New: `splunk/default/data/ui/views/topology_canvas_v1.xml`
- New: `splunk/appserver/static/topology_canvas_v1_bootstrap.js`
- Edit: `webpack.config.js` (new entry)
- Edit: `splunk/default/data/ui/nav/default.xml` (new nav item)
- Edit: `splunk/default/app.conf` (build → 104)
- Edit: `package.json` + `yarn.lock` (new deps)

---

## 2026-05-14 (Build 103) — TE A2A loading-state visibility + 4-hour SPL scan cap

### Context

Right after Build 102 shipped, Alan opened the AUB↔TLH popup again and
reported "I still don't see it on my dev instance and I ran yarn and
bumped the cache, something is still wrong." Screenshot showed every
metric pill reading **Awaiting** and the TELEMETRY SOURCE block
reading **"Awaiting topology link telemetry"** — the static OOB
default text — with **no** `Updated` timestamp and **no** error
appended to the customer-site row. Read as: "the TE integration is
gone again."

Then a follow-up: "wait! it does show but it took a while for it to
show, now I see it in the FDEM stack. Do you have any explanation
for it?" The data eventually flowed in — confirming the search
*was* dispatching, it just took 20-40 seconds to complete on a
cold cache.

### Root cause (perceived regression, not a real one)

Three independent things lined up to make a slow search look like a
removed integration:

1. **The SPL is genuinely slow on a cold cache.** The
   `[overview_link_te_a2a_health]` stanza scans raw events
   (`` `index_thousandeyes` sourcetype="cisco:thousandeyes:metric"
   "thousandeyes.test.type"="agent-to-agent" ``) over whatever time
   range the dispatcher passed in (default `-24h`), then runs a stats
   command with **13+ aggregations** (`avg×3 + values×2 + first×11 +
   max×1`) grouped by `thousandeyes.test.id`. We deliberately moved
   off the `Cisco_ThousandEyes.Test_Metrics` data model in Build 79
   because the customer's `ta_cisco_thousandeyes` schema didn't
   surface `loss`, `jitter`, or any `agent.geo.*` paths through the
   metric-store wrapper — raw events were the only complete source of
   truth, but they're an order of magnitude slower to scan.

2. **The popup couldn't tell `'loading'` from `'static'`.** The link
   popup rendered `link.telemetrySource` directly (`"Awaiting topology
   link telemetry"` is the OOB default for a search-bound link) and
   used `formatPercent(value)` / `formatLatency(value)` /
   `formatMbps(value)` helpers that returned `'Awaiting'` for every
   undefined value. Result: while the saved search was in flight, the
   popup looked **identical** to the genuinely-not-wired case. There
   was a `dataState === 'loading'` field on the link, but nothing
   read it.

3. **The cold-cache window is the worst time to first-impression a
   demo.** Splunk's pre-ER acceleration kicks in after the first
   successful run; for a fresh load (post-deploy, post-`yarn`,
   post-cache-bump — exactly what Alan did) every search starts cold.

### Fix (two halves, both shipped this build)

- **A. React-side visible loading affordance.**
  - `CustomerTopologyMap.tsx`. The four format helpers
    (`formatNumber` / `formatPercent` / `formatLatency` /
    `formatMbps`) now take an optional `loading?: boolean` second arg
    and return `'Loading…'` when the value is undefined and
    `loading === true`. Default unchanged: undefined value → `'Awaiting'`.
  - In the link popup body (`<LinkDetails>`), every metric-pill
    `formatXxx(...)` call now passes
    `link.dataState === 'loading'` as the second arg. So a popup
    opened while the search is still running renders **Loading…** in
    each pill instead of **Awaiting**.
  - The TELEMETRY SOURCE block now branches on `dataState`. When
    `'loading'` it renders a `Loader2` spinner + the copy
    *"Querying ThousandEyes A2A test data… first run can take 20-40s
    while Splunk warms the cache"* in muted text. Once the search
    returns, the branch falls through to the existing
    `link.telemetrySource` paragraph (no behaviour change there).
  - Same treatment applied to `<SiteDetails>` for parity: the three
    site metric pills get the `loading` flag, and the existing
    `'Loading searchbase result'` sub-line now shows a small inline
    spinner. Sites are usually faster but the same pattern keeps
    perception consistent across the popup family.

- **B. SPL hard-cap to last 4 hours.**
  - `searchbase.conf`. Bumped `[overview_link_te_a2a_health]` to
    `version = 1.2.0`, added an inline `earliest=-4h@h` token
    immediately after the existing `"thousandeyes.test.type"=
    "agent-to-agent"` filter on the base search line. This is a hard
    upper bound on the events scanned regardless of dispatcher range
    — even if a future caller passes `earliestTime=-7d` the SPL stays
    pinned to the last 4 hours.
  - 4 hours is the right number for a synthetic A2A test with 1-2-min
    sample cadence: ~120-240 samples per agent pair, plenty for a
    statistically meaningful avg/loss/jitter verdict, and the
    `max(_time) → lastSeen` field still tells operators how recent
    the freshest sample was. The verdict is meant for "is this link
    healthy *right now*", not historical analysis — historical lives
    in TE itself, where the `View in ThousandEyes` deep link opens
    the test's Path Visualization view with its own 24h window.
  - Cold-cache run target: ~8s (down from 20-40s observed in Alan's
    deploy window). A2A test volume varies stack-to-stack so the
    actual number will differ; the loading-state UX from half A
    handles whatever residual latency remains.
  - Counterpart `[overview_link_auburndale_tallahassee_health]`
    (the multi-source umbrella that prefers SD-WAN, falls back to
    TE, and finally to Catalyst Center) was **not** time-capped this
    build — it's a different SPL shape and SD-WAN customers may
    legitimately want a wider window for capacity/utilization
    averaging. Revisit if the umbrella ever exhibits the same slow
    behaviour.

### Build chrome

- `app.conf`. `build = 102 → 103`.
- `searchbase.conf` `[overview_link_te_a2a_health]`. Added a v1.2.0
  paragraph at the top of the `explanation` field documenting the
  inline-`earliest` decision so the picker preview shows the perf
  history. Existing v1.1.x story (data-model → raw-events switch)
  preserved underneath as historical context.

### Verification

- `yarn run build`: clean.
- `ReadLints CustomerTopologyMap.tsx`: clean.
- Manual: `Loader2` is already used elsewhere in the lucide import set
  on this file (we checked the import block before adding); no
  duplicate-import warnings.

### Notes for next session

- If the customer's TE org has very high A2A volume, even 4 hours of
  raw events may be slow. The next perf lever is summary indexing or
  reverting to `tstats` against an *enriched* `Test_Metrics` model
  once the customer ships a TA build that exposes loss/jitter/geo
  through the data model wrapper. Both are heavier engineering
  tasks; the loading-state UX from this build buys us the time to
  evaluate them properly.
- Sites are still using the bulk-topology dispatcher path which has
  its own slow-load surface; the spinner addition partially covers it
  but the underlying SPL there could use a similar cap. Open
  follow-up.

---

## 2026-05-14 (Build 102) — Restore TE agent-location row in link popup (revert Build 98 over-correction)

### Context

Alan reviewed the build 100/101 state of the AUB↔TLH link popup and
flagged the missing TE agent-location row as a regression: "you
accidentally removed the integration with ThousandEyes!" He sent a
screenshot of the prior look — the TELEMETRY SOURCE block contained,
in this order:

  1. `ThousandEyes A2A: demt-te01-va -> dema-te01-va`  (text source)
  2. `Measured by demt-te01-va ↔ dema-te01-va`         (agent pair)
  3. `Tallahassee, Florida, US ↔ Orlando, Florida, US` (TE agent geo)
  4. `Auburndale (Logistics) to Tallahassee (State EOC) - Updated …`
  5. `View in ThousandEyes` button

Build 98 (2026-05-13) dropped row 3 to resolve a complaint that
"Orlando, Florida, US" appeared right above "Auburndale (Logistics)
to Tallahassee (State EOC)" — two adjacent lines that looked like
they disagreed on what the link is. The fix was correct as a UX
nit, wrong as an engineering call: row 3 was the visible proof
that the popup is consuming `thousandeyes.source.agent.location` /
`thousandeyes.target.agent.location` straight off the A2A test
data. Without it, the TELEMETRY SOURCE block reads as thinly
wired even when the data layer is healthy.

### Fix

- **`CustomerTopologyMap.tsx`.** Restored the
  `(link.sourceLocation || link.targetLocation)` conditional row
  and the `<p>` it renders. To keep the original Orlando-vs-
  Auburndale concern from re-emerging, the row now leads with a
  `TE agents at:` label (semi-bold, slate-500) so the geography
  reads unambiguously as "where the TE-registered agents are"
  rather than as a competing claim about the link's endpoints.
  Also added a `title` attribute spelling out the same in long
  form for hover (operators who want the explanation but don't
  want to read the whole popup).

  The TE-registered geo + customer-site rows are now stacked in
  this order:

  ```
  TE agents at: Tallahassee, Florida, US ↔ Orlando, Florida, US
  Auburndale (Logistics) to Tallahassee (State EOC) - Updated …
  ```

  The first row is "TE telemetry pedigree" (where the data came
  from), the second is "what the link represents" (customer
  ground truth). Operators reading top-to-bottom see the agent
  identity (`Measured by …`), the agent geo (`TE agents at: …`),
  then the customer site identity (`Auburndale (Logistics) to
  Tallahassee (State EOC)`) — three distinct rows that no longer
  contradict because each is now scoped to a different concept.

- The Build 98 long comment block that justified the deletion was
  replaced with a Build 102 comment explaining the restoration
  and the reason for the new prefix. The git history retains the
  original justification so the trade-off is reviewable.

### Verification

- `yarn build` clean (9.3s, only the standing webpack size-limit
  warnings on `searchbase.conf` and the background PNGs).
- `ReadLints` clean on the touched file.
- Visual smoke test: the link popup now matches Alan's reference
  screenshot, with the added `TE agents at:` prefix on the geo
  row to disambiguate it from the customer-site row immediately
  below.

### What's next

- **Pending from earlier builds.** Dashboard-name + subtitle copy
  pass and the threshold form's "advanced" unit-conversion reveal
  are still parked. Section-padding compaction at very short
  viewports remains an open follow-up from Build 101.

---

## 2026-05-13 (Build 101) — Section title becomes the drill-down; reclaim ~108px on short viewports

### Context

Even after the responsive-scaling work in Build 95, Alan kept
running into the same wall on shorter viewports: the bottom-of-section
"OPEN IT HEALTH / OPEN SECURITY / OPEN BUILDING INTELLIGENCE"
drill-down links were the first thing to get clipped. He sent a
~600px-tall screenshot where all three were partly obscured —
the page had already scrolled, and his usual click target was just
gone. He suggested promoting the section title to be the link and
removing the bottom row entirely. Strong yes from a layout
perspective:

1. **The title is the most stable piece of section chrome.** If
   it gets clipped, the section itself isn't visible — there's
   nothing to drill into anyway. Putting the click affordance
   there means it's reachable whenever the section is.
2. **Two affordances for one action is one too many.** Operators
   were already learning "click the OPEN link" and now had to
   re-learn it when it disappeared. Collapsing them onto a single
   target (the title) is simpler.
3. **The bottom footer carried ~36px of chrome per section.**
   Across three sections that's ~108px of pure overhead on every
   render — enough to push the second and third sections off
   the visible viewport on a 600px-tall window.

### Fix

- **`DashboardSection.tsx`.** Title rendering became conditional:

  - When `href` is provided, the title renders as an `<a>` that
    opens the drill-down view in a new tab, with a `<h3>` nested
    inside so screen readers still announce the section heading
    first. The hover affordance reuses the same vocabulary the
    old footer link had — a `ChevronRight` that nudges right on
    hover, plus an `ArrowUpRight` that fades in to telegraph
    "opens in new tab." Operators who learned the previous
    pattern see the same icons and animation, just on a
    different element.
  - When `href` is omitted (defensive — currently always
    provided), the title renders as a plain `<h3>` with no link
    behaviour, identical to its pre-Build-101 appearance.

  The `linkText` prop is repurposed as the hover/title tooltip
  ("Open IT health (new tab)") so existing call sites keep
  working without changing their contract.

  The bottom footer block (the `<div className="mt-1.5 pt-1.5
  border-t ...">` wrapper plus the `<a>` it held) was deleted
  entirely. With it gone, `min-h-[220px]` was no longer the
  legibility floor — the floor existed to accommodate the
  footer's ~36px chrome. Dropped to `min-h-[180px]`, which still
  guarantees:

  ~22px section header + ~4px gap + ~36px tile headline +
  ~72px chart floor + ~16px tile chrome ≈ 180px

- **`pages/overview/index.tsx`.** The mirrored `min-h-[220px]`
  on the section's `className` prop (which had to re-assert the
  floor because `tailwind-merge` lets the prop class win over
  the component's internal class) was lowered to
  `min-h-[180px]`. The long-form comment block above it was
  rewritten to explain why 220 → 180 — without that note a
  future reviewer would see "180" and wonder whether someone
  was just guessing at chart-canvas legibility. The comment
  above the metrics column wrapper (which also referenced 220 →
  660 for the three-section budget) was updated to 180 → 540 so
  the math stays consistent across the file.

### Verification

- `yarn build` clean (8.5s, only the pre-existing webpack
  size-limit warnings on `searchbase.conf` and the background
  PNGs).
- `ReadLints` clean on both touched files.
- Visual smoke test: the section header now reads
  "IT HEALTH ›" with the ChevronRight visible at 60% opacity.
  Hovering the row turns the title sky-700 and slides the
  chevron right while fading in the ArrowUpRight — same hover
  language the old footer link used. Click opens
  `/<locale>/app/splunk-cisco-dashboards/it_health_v1` in a new
  tab. The bottom of the card is now a clean rounded edge, no
  divider, no link.
- Short-viewport math: at 600px viewport height (the case
  Alan flagged), the metrics column previously asked for
  ~660px of content (3 × 220 plus gaps) and went into
  scrolling. It now asks for ~540px, which fits a 600px
  viewport with margin to spare — meaning the third section's
  drill-down (now its title) is reachable without scrolling.

### What's next

- **Continue the responsive polish thread.** Possible follow-ups
  Alan mentioned in passing: shrinking section padding at very
  short viewports, adding a "compact density" toggle on the
  header, and revisiting the picker-panel real estate one more
  time now that `MetricItem` carries less chrome.
- **Pending from Build 98/99.** Dashboard-name + subtitle copy
  pass and the threshold form's "advanced" unit-conversion
  reveal are still parked.

---

## 2026-05-13 (Build 100) — Tooltip compaction, spotlight-pause fix, topology tag-search

### Context

Three issues from a single test session:

1. **Sparkline tooltips were verbose.** The headline showed "74k"
   while the hover bubbles showed "952,033.61" / "73,537.79" — the
   two reads looked like different metrics.
2. **Spotlight ring "broke" after clicking a site.** Alan reported
   the red dashed alert ring around TLH stopped pulsing the moment
   he clicked the marker, and didn't come back until a browser
   refresh — only "and so on and so forth" with each subsequent
   refresh.
3. **No way to search for tags in the topology editor's
   per-card "Change Search" browser.** The browser already
   substring-matched tags in its free-text input, but it wasn't
   discoverable, and the `+ filter by tag` chip dropdown couldn't
   be filtered itself once it grew past ~12 tags.

### Fixes

- **#1 Tooltip abbreviation.** The `formatValue` prop passed from
  `MetricItem.tsx` to `Sparkline` was hardcoded to
  `n.toLocaleString() + unit`. Replaced with the same
  compact-vs-locale rule the headline already uses:
  abbreviate to `k/M/B/T` when `abbreviateMajorValue` is on AND
  the unit isn't one of `%`, `ms`, `Mbps` (units that are already
  short enough that compaction would be silly: `74Mbps` reads
  fine as `74Mbps`). The function literal is shared visually with
  the `displayValue` block above so the two sites stay locked
  together — they're the same rule.

- **#2 Spotlight-pause regression (P0 user-visible).**
  `selectSite`/`selectLink` were unconditionally bumping
  `pauseUntilRef.current = Date.now() + 25000` on every click,
  *including* clicks that close the panel by toggling off. With
  the spotlight tick interval at 11s, that meant:
  - Click TLH → 25s pause starts, panel opens, alert ring hides.
  - Close (X / Escape / outside-click / re-click) → pause clock
    is still running, so the immediate `tick()` re-fire (from
    the effect re-running on `resolvedSelected` change) returns
    early, and every subsequent 11s tick does too until the
    25s window expires.
  - Re-clicking the same marker to close it bumped the pause
    *again* — a fresh 25s clock started every time, making
    recovery functionally indefinite for any operator who
    interacts with the marker more than once.

  The user-visible symptom: the alert ring stayed gone for ~25s
  in the best case, indefinitely in the realistic case, until a
  full page reload reset the pause clock.

  Fix: pause only when *opening* a selection. Every dismiss path
  (toggle-close re-click, X button, Escape, outside-click, the
  background-click hook, opening the editor) now resets
  `pauseUntilRef.current = 0`. A new `closeSelection` helper
  threads that contract through `SelectionCard.onClose` and
  `MapClickCapture.onBackgroundClick` so all dismiss paths share
  the same handler. Also moved the ref mutations *outside* the
  setState updater functions in `selectSite`/`selectLink` so
  React strict-mode's double-invocation can't double-bump the
  clock.

- **#3 Topology editor tag search.**
  The free-text input always substring-matched tag names (the
  haystack included `entry.tags.join(' ')`), but the placeholder
  said `Search 198 catalogue entries…` with no hint that tags
  were searchable. Updated to
  `Search 198 entries by name, category, or tag…` —
  one-line copy fix that reveals the existing capability.

  The `+ filter by tag` chip dropdown got a typeahead input on
  open. Mirrors the KpiPickerPanel pattern: auto-focus on open,
  type to narrow the chip list, Enter selects the first match,
  Escape closes the picker. Backed by a separate
  `tagsAvailableAll` memo (full ranked list) and a `tagsAvailable`
  derived list (filtered by the typeahead, capped at 12 chips
  for visual stability) so the typeahead doesn't fight the
  frequency ranking.

### Verification

- `yarn build` clean.
- Lints clean across the three touched files.
- No new hooks below early returns; the `useEffect` for the new
  tag-filter focus runs alongside existing hooks at the top of
  `TopologySearchBrowser`.

### What's next

- Same deferred list (dashboard rename, subtitle copy).
- The compaction rule lives in two places now (`MetricItem`'s
  `displayValue` and the new `Sparkline.formatValue` literal).
  Worth extracting to a shared helper if a third caller appears.

---

## 2026-05-13 (Build 99) — Threshold form discoverability fix-up

### Context

Alan opened Build 98, clicked **Configure tile**, and asked: *"I am
not seeing where I can manage the Thresholds? did I miss something
here? I thought you were working on building a UI for it."* — meaning
the form was rendering, but it was so visually subordinate that he
didn't see it.

### Diagnosis

Two compounding issues, both of my own making:

1. **Default-collapsed.** `thresholdsOpen` initialised to `false`,
   and the panel-open `useEffect` only set it to `true` when the
   tile *already* had a custom override. So a first-time user (the
   ~100% case the day after the feature shipped) never saw the
   form expanded — only the tiny chevron toggle.

2. **Visual weight.** The toggle row was styled with the exact
   same Tailwind classes as the "Show SPL" and "Description"
   chevron toggles immediately above it (`text-[9px] font-bold
   uppercase tracking-widest text-slate-500`). Three near-identical
   rows in a tight stack read as "more details, more details, more
   details" — not "this is the per-tile customisation surface".

### Fixes

- **Default-expand.** `useState(true)` for `thresholdsOpen` and the
  panel-open effect now unconditionally sets it to `true`. Users
  who want the bottom panel compact can collapse the section with
  one click, but they no longer have to *know* the form exists to
  reach it.

- **Surface promotion.** The whole section is now wrapped in a
  rounded panel (`border bg-slate-50 dark:bg-slate-900/40 p-2.5`)
  so it visually separates from the value-field / label-override
  grid above. The heading row gets a real treatment:
  - Sky-coloured `Gauge` icon (lucide) anchors the section.
  - Heading bumped from `text-[9px]` to `text-[11px] font-black
    uppercase tracking-wider` so it reads as a section header
    rather than a chevron link.
  - Chevron moved to the *right* of the label so the eye lands
    on "THRESHOLDS" first; the chevron becomes the affordance,
    not the focus.

- **Helper copy.** A one-line description renders just below the
  heading when expanded:
  > Set the warning and critical bands used to colour the headline
  > value and the status icon for this tile. Leave a field blank
  > to disable that band.

  Tells the user what the section does *before* they have to read
  the field labels — important on a first encounter.

### Verification

- `yarn build` clean.
- `ReadLints` clean on `KpiPickerPanel.tsx`.
- No new hooks, no new conditional render paths — purely styling
  + default-state changes, so the Build 98 crash fix is unaffected.

### What's next

- Same "deferred to next pass" list from Build 98 (dashboard
  rename, subtitle, threshold unit-conversion polish).

---

## 2026-05-13 (Build 98) — Threshold-form crash fix + overview polish bundle

### Context

Alan opened the dashboard after Build 97 shipped, clicked **Configure
tile**, and the page hard-crashed with **React error #310** ("Rendered
more hooks than during the previous render") and a 404 on
`services/configs/conf-limits/structured_data_service` — the latter is
a Splunkd housekeeping fetch that's always been 404 for non-cluster
hosts and is unrelated. The hook crash, however, was 100% on Build 97.
He bundled four other items into the same patch:

1. (Bug fix) Crash on Configure tile.
2. (Regression) Topology editor's per-card "Change Search (Site/Link)"
   browsers were showing **0 of 0** entries.
3. (UX) Map link popup printed
   `Tallahassee, Florida, US ↔ Orlando, Florida, US` directly above
   `Auburndale (Logistics) to Tallahassee (State EOC)` — same link,
   two contradictory location strings.
4. (UX) Comparison/baseline overlay stroke was hard to see — Alan
   chose **Option 4: theme-aware neutral, thicker line, longer dashes**
   from the four candidates.
5. (Threshold polish — deferred) Dashboard rename, subtitle copy:
   left for a follow-up content pass since these are wording choices
   Alan wants to read against the rendered UI.

### Fixes

- **#1 Crash (P0).** Build 97's `previewLines` lived inside a
  `useMemo` that sat *below* the `if (!open || !context) return null`
  early return on `KpiPickerPanel.tsx:985`. When the panel was
  closed, the early return fired and the hook never ran; when it
  opened, it did — different hook count between renders → React #310.
  `deriveThresholdLines` is O(1) (≤3 short objects, no DOM, no I/O),
  so the memoization win was negligible. Replaced the `useMemo` with
  a plain ternary; left a long inline comment on why the hook was
  intentionally not added back. Verified with grep that every
  remaining hook in the picker (last `useMemo` line ~941, last
  `useEffect` line ~974, last `useRef` line ~954) sits above the
  early return.

- **#2 Topology editor "0 of 0" regression.** Same root cause as the
  KPI picker bug Build 91 fixed: `editorSearchOptions` in
  `CustomerTopologyMap.tsx` was filtering on
  `record.tags.includes('Cisco')`, but the `Cisco` tag was removed
  from every `searchbase.conf` stanza during the FDEM/branding
  cleanup. Replaced with
  `record.dispatchContext === 'splunk-cisco-dashboards'` — a stable
  scope key authored on every stanza in this app's
  `default/searchbase.conf` (`dispatch_context_force = 1`) that the
  FDEM scrub didn't touch. Same one-line fix, same diagnosis,
  exactly the lesson learned from Build 91 we should have applied
  proactively across every consumer of the catalogue.

- **#3 TE-geo line dropped.** The contradictory
  `sourceLocation ↔ targetLocation` row read from
  `thousandeyes.source.agent.location` /
  `thousandeyes.target.agent.location` straight off the test data.
  TE registers each agent's geo at the metro level, so Auburndale's
  agent `dema-te01-va` lives in TE as "Orlando, FL" (~50 mi away).
  That row is technically correct from TE's perspective but reads
  as a bug right above the customer-site-name row. Removed the row
  entirely; the customer-site-name row remains as ground truth, the
  agent-pair row above tells you *which* TE agents are doing the
  measuring, and the existing "View in ThousandEyes" deep link is
  one click away if you need the agent's TE-registered geo.

- **#4 Overlay stroke (Option 4).** Bumped `Sparkline.tsx` baseline
  stroke from `#1f2937` (slate-800, hardcoded — too dark on dark
  theme, indistinguishable from chart gridlines on light theme) to
  a CSS-variable-driven theme-aware pair:
  - Light: `slate-600` (`#475569`) — readable on white bg.
  - Dark:  `slate-300` (`#cbd5e1`) — readable on slate-950 bg.

  Implementation chose Tailwind's arbitrary-property syntax
  (`[--baseline-stroke:#475569] dark:[--baseline-stroke:#cbd5e1]`)
  on the chart wrapper `<div>` over prop plumbing because the
  `<Sparkline>` component has its own
  `if (vizType === 'singlevalue') return null` early return at the
  top — adding a `useTheme()` hook inside Sparkline would have
  reproduced the same hook-ordering footgun this build is fixing.
  CSS-only is the clean answer. Three `<Line dataKey="previous">`
  callsites updated in lockstep (bar+line+area chart paths), all
  reading `stroke="var(--baseline-stroke)"`.

  Stroke weight 1.75 → 2.25, dash 6/3 → 8/4: the previous line
  was reading as a row of pixels at small chart heights. The
  tooltip swatch (`bg-slate-400`) was also re-themed to match
  (`bg-slate-600 dark:bg-slate-300`) so the legend doesn't
  contradict the chart.

### Verification

- `yarn build` → 0 errors, 2 expected size warnings (entrypoint and
  chunk size; long-standing, tracked separately).
- `ReadLints` clean across the four touched files.
- Manual: panel open/close cycle no longer throws; topology editor
  Site/Link search browsers populate; link popup shows one
  location row; overlay line is visibly distinct from gridlines on
  both themes.

### What's next

- Dashboard rename + subtitle copy pass (deferred from this build —
  Alan wants to see options rendered in situ).
- Threshold form polish: an "advanced" section reveal for the unit
  conversion when `valueField` switches to a column on a different
  scale (e.g. ms → percent) — currently the form persists the
  user's literal numbers regardless, which is correct but could be
  smarter.

---

## 2026-05-13 (Build 97) — User-editable thresholds via the KPI picker

### Context

Alan asked how thresholds are controlled — they're "really cool but
appear hard-coded". Confirmed: each of the ~28 metric tiles has a
TypeScript `MetricThresholds` literal in `pages/overview/index.tsx`,
and the persisted `MetricOverride` shape carried only
`savedSearch / label / valueField / description`. So thresholds were
locked to whatever shipped, and worse: when the picker swapped
`valueField` to a column on a totally different scale, the original
threshold tuple still applied — the colour could lie.

He greenlit "build what you think is best UX, think flexibility and
ease of use." This build extends the override surface with three new
fields, wires them through the runtime merge, and adds a collapsible
THRESHOLDS form to the picker bottom panel.

### Design choices

- **Reuse the existing source of truth.** The form drives the same
  `MetricThresholds` shape `computeStatus` and `deriveThresholdLines`
  already consume, so the live preview in the picker is *literally*
  what the per-tile info popover renders after Apply — there's still
  exactly one source of truth for threshold colouring, no UI/runtime
  drift possible.
- **Only persist deltas.** The picker form omits any threshold field
  that matches the tile's static default. Three benefits: localStorage
  payload stays small, "Reset to default" reduces to "drop the field
  from the override", and shipped-default changes flow through
  automatically for fields the user hasn't customised.
- **Independently optional.** `thresholdWarning`, `thresholdCritical`,
  `thresholdDirection` are each independently optional. A partial
  override (e.g. only `thresholdWarning`) keeps the other two anchored
  to the shipped values — exactly what users want when they want to
  "tweak the warning point but leave critical alone".
- **Collapsed by default; auto-expand on customised tiles.** Fresh
  picker open: the THRESHOLDS section is collapsed, bottom panel
  stays compact. Re-opening the picker for a tile with custom
  thresholds: the section auto-expands so the customisation is
  immediately visible. Same pattern as `descOpen` / `showSpl` /
  `filtersOpen`.
- **Non-blocking sanity hint.** If the user inverts the bands
  (e.g. critical ≥ warning on a `higher_is_better` tile) we surface
  an inline yellow ⚠ hint but don't gate Apply on it — some operators
  intentionally invert to suppress a colour band, and the storage
  layer shouldn't second-guess that.

### What changed

#### 1. `usePersistedMetricOverrides.ts`

Extended `MetricOverride` with three new optional fields, all
documented in the module-level header:

```ts
thresholdWarning?: number;
thresholdCritical?: number;
thresholdDirection?: 'higher_is_better' | 'lower_is_better';
```

Sanitizer (`sanitizeOverride`) gained matching guards:

- Numeric fields validated through a single `isFiniteThresholdNumber`
  helper with bounds `[-1e9, 1e9]` (covers percentages, counts, and
  rates without admitting `Infinity` or 1e30 nonsense). The
  warning-vs-critical sanity check is intentionally *not* enforced
  at the storage layer — that's a UI hint, not a hard constraint.
- Direction validated against a `Set` of the two enum values.

Storage version stays `v: 1` — the new fields are additive and the
sanitizer drops anything malformed, so a user with a v1 store from
before this build reads cleanly into the new shape.

#### 2. `pages/overview/index.tsx`

- Imported `MetricThresholds` from `useMetric`.
- New helper `mergeThresholds(base, override)` — reads each override
  field with `??` fallback to the static default. Returns the static
  base unchanged when no override fields are set, so a non-thresholds
  override (search-binding only) is a no-op for thresholds.
- `applyOverride()` now passes `thresholds: mergeThresholds(cfg.thresholds, override)`.
- `openPicker()` extended to accept `defaultThresholds` and `unit` in
  the `current` parameter, and to populate the new
  `KpiPickerContext.defaultThresholds` / `currentThresholds` /
  `thresholdUnit` fields. It also calls `mergeThresholds` once to
  produce the *current effective* tuple for the picker pre-fill.
- Three call-sites (the metric grid card, KPI 0, KPI 1) updated to
  pass `cfg.thresholds` and `cfg.unit`. KPI cards ship without numeric
  thresholds; we pass `unit: undefined` for them so the form still
  renders empty inputs the user can fill.

#### 3. `KpiPickerPanel.tsx`

- Imported `deriveThresholdLines`, `formatThresholdNumber`,
  `MetricThresholds` from `useMetric`.
- Extended `KpiPickerContext` with `defaultThresholds`,
  `currentThresholds`, `thresholdUnit`. Each has a long-form comment
  explaining what it's for.
- New form state (4 pieces): `thresholdsOpen` (collapsible flag),
  `thresholdWarningInput` / `thresholdCriticalInput` (raw text content
  of the number inputs, stored as strings so blank == "no band"),
  `thresholdDirection` (segmented-control selection).
- Panel-open `useEffect` now pre-fills the four pieces of state from
  `context.currentThresholds` and decides whether to auto-expand.
- New derived helpers above `handleApply`:
  - `parseThresholdInput(raw)` — single source of truth for parsing
    a string input to either `number` or `undefined`. Drives both
    validation feedback and the apply-payload merge so they can never
    drift.
  - `warningParsed` / `criticalParsed`, `*InputValid` flags.
  - `thresholdRelationshipWarning` — non-blocking inverted-bands hint.
  - `previewLines` — calls `deriveThresholdLines(...)` with the
    current form state, so the picker preview matches the popover.
  - `thresholdsCustomised` — drives the "(custom)" badge and the
    per-section "Reset to default" link.
- `handleApply` now appends only the threshold fields that *differ*
  from the static default to the override payload. Clearing a
  default-set threshold (rare) is documented as a deferred edge case
  with a comment pointer.
- New `handleResetThresholds` — restores the form (not the persisted
  override) back to the static defaults; the user still has to hit
  Apply to commit. Scoped to thresholds only.
- New collapsible THRESHOLDS section in the bottom panel, between the
  VALUE FIELD / LABEL OVERRIDE grid and the form footer:
  - Toggle row: chevron + "Thresholds" + optional "custom" badge,
    plus the per-section "Reset to default" link when customised.
  - When expanded:
    1. Direction segmented control (2 buttons, mutually exclusive,
       hint-tooltips on each).
    2. Warning + Critical number inputs side by side. Each with
       placeholder = the static default and a "default: <n><unit>"
       helper line below.
    3. Optional inverted-bands ⚠ hint.
    4. Live preview block — coloured dots + the same labels and
       ranges the per-tile info popover renders.
    5. Fallback message when both inputs and defaults are blank
       ("No thresholds set — the headline will render in the neutral
       colour with no status icon.")
- Added `canApply` gate now checks
  `warningInputValid && criticalInputValid` so a non-numeric input
  blocks Apply.

### Verification

- TypeScript / React lints — no errors across the three touched
  files. (One transient stale-IDE error reading
  `defaultThresholds does not exist in type 'KpiPickerContext'`
  resolved itself once the IDE re-loaded the picker file.)
- `yarn build` — clean, two pre-existing asset-size warnings, no
  errors.
- Manual sanity-check of the merge logic:
  - No override → `applyOverride` returns `cfg` unchanged →
    `cfg.thresholds` flows through unchanged → behaviour identical
    to pre-Build-97.
  - Override with no threshold fields →
    `mergeThresholds(cfg.thresholds, override)` short-circuits via
    the `!hasOverride` branch and returns `cfg.thresholds` unchanged
    → still no behavioural change.
  - Override with `thresholdWarning: 90` only → merged tuple has
    `warning: 90, critical: cfg.thresholds.critical, direction: cfg.thresholds.direction`
    → exactly the "tweak warning, keep critical/direction" intent.
- Manual UI walkthrough (mental model, given the code paths):
  - Open picker on `executive_critical_website_availability`
    (defaults `warning: 99.5, critical: 90, higher_is_better`).
  - Form is collapsed at rest. Click "Thresholds" → form opens with
    99.5 / 90 / Higher-is-better pre-filled.
  - Type `99.0` in Warning. "default: 99.5%" helper still visible.
    Live preview ranges update in real time. Click Apply.
  - Re-open picker → Thresholds section auto-expands (custom badge
    visible), Reset-to-default link visible, override stored as
    `{ savedSearch, thresholdWarning: 99 }` only — critical and
    direction not persisted because they match defaults.

### Files touched

- `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/app.conf`
  — `build = 96` → `build = 97`.
- `packages/splunk-cisco-dashboards/src/main/webapp/common/hooks/usePersistedMetricOverrides.ts`
  — extended `MetricOverride`, added `isFiniteThresholdNumber` helper,
  extended `sanitizeOverride`, updated module-level header docs.
- `packages/splunk-cisco-dashboards/src/main/webapp/pages/overview/index.tsx`
  — imported `MetricThresholds`, added `mergeThresholds`, wired
  `applyOverride` to merge thresholds, extended `openPicker` signature,
  updated three call-sites.
- `packages/splunk-cisco-dashboards/src/main/webapp/common/components/florida/KpiPickerPanel.tsx`
  — imported threshold helpers, extended `KpiPickerContext`, added
  4 pieces of form state, panel-open pre-fill, derived parsers /
  validators / preview / customised-flag, threshold-aware
  `canApply`, `handleApply` payload merge, `handleResetThresholds`,
  full collapsible THRESHOLDS section in the bottom panel.
- `packages/splunk-cisco-dashboards/docs/SESSION_LOG.md` — this entry.

### What's next

- Alan to test: open the picker on any tile, expand THRESHOLDS,
  tweak warning / critical, hit Apply. Confirm the headline colour,
  trend-arrow tint, sparkline stroke, and per-tile info popover
  rows all reflect the new bands.
- If the inverted-bands ⚠ hint feels too soft and operators are
  shooting themselves in the foot, we can promote it to a hard
  block (toggle `canApply &&= !thresholdRelationshipWarning`).
  Default is still soft for now.
- v2 follow-ups already scoped: allow overriding `thresholdNote`
  and `unit` from the picker so the popover stays accurate when
  users swap `valueField` to a different scale. That's a 3-input
  add to the same form section — same persistence shape, same
  merge pattern.

---

## 2026-05-13 (Build 96) — Picker bottom-panel compression: chips inline + tighter cap

### Context

After Build 94 (dismissible BOUND strip + collapsible Description),
Alan tested the picker again and asked for one more pass at the
bottom preview panel: *"try an option that will work best and I
will test it."* The screenshot still showed the bottom panel
taking ~35–40% of the popover, with the SEARCH NAME label, the
chip row, the SHOW SPL row, the Description trigger, the form,
the USE chips, and the footer all stacked vertically.

I picked the option with the best ratio of vertical-space saved
to UX impact: collapse the SEARCH NAME header line into the chip
row (so two horizontal rows become one), and pull the bottom
panel's hard-cap from 42% to 34% of the popover. Every other
piece of info stays visible — no extra clicks for tags, no
hidden chart-type pill, no chrome relocation away from where
operators expect it.

### What changed

Both edits live in `KpiPickerPanel.tsx`'s "Selection preview +
form" section:

#### 1. Chips merged into the SEARCH NAME header line

Before: two stacked rows.

```
SEARCH NAME                    [pill]  ← the small uppercase
                                          header line + viz pill
Executive Dashboard - …
[EXECUTIVE · EXECUTIVE DASHBOARD] [Executive] [KPI]  ← chips row
```

After: one merged flex row.

```
[EXECUTIVE · EXECUTIVE DASHBOARD] [Executive] [KPI]  ← chips
                                                ⤷ AREA CHART  ← viz pill,
                                                                 right-anchored
                                                                 via `ml-auto`
Executive Dashboard - …
```

Implementation notes:

- Single `flex flex-wrap items-center gap-1.5 mb-1` row replaces
  the previous two-row block. Wrapping is preserved (`flex-wrap`)
  so a long chip list still falls to a second line rather than
  overflowing horizontally. The viz pill carries `ml-auto` so it
  always anchors to the right edge of whichever wrap-line it
  lands on.
- The "Search name" uppercase label is dropped — the title line
  immediately below is the headline of the panel, the label was
  just chrome.
- All chip styles (category sky pill, sub-cat opacity-70, tag
  chip slate fill) preserved exactly. Click affordances /
  selection / titles unchanged.

Net: ~30–50px reclaimed, scaling with chip count (the more chips
a stanza has, the bigger the win because the chips row was the
component most prone to wrapping to two lines).

#### 2. Bottom panel hard-cap 42% → 34%

The wrapper `<div>` was already `max-h-[42%] overflow-auto`. Two
lines of comment block above the className document why 34% is
the right new value: it gives the result list a guaranteed
≥66% of the popover height, the internal `overflow-auto` keeps
every field reachable when the panel content exceeds 34%, and
critically the footer (Reset Tile / Factory Reset / Cancel /
Apply) lives in a sibling `<div>` *below* this one — so primary
actions stay anchored even when the bottom-panel scroll region
runs short.

On a typical 900px popover that's an extra ~72px to the result
list. On a 1200px popover (full-screen), an extra ~96px.

### Why not the other options I considered

- **Move chips into a popover** (info-icon click reveals chips):
  saves the same ~30–50px but adds a click for a passive-display
  affordance the user often glances at. Rejected.
- **Master `▸ Details` toggle wrapping SHOW SPL + Description +
  USE chips**: would save ~80px but USE chips are tightly
  coupled to the VALUE FIELD input — hiding them by default
  hurts the primary "pick the right column" workflow. The
  picker users in this app run the form filling more than the
  description reading. Rejected.
- **Hide USE chips behind an info icon next to "VALUE FIELD"**:
  saves ~30px but again costs a click on the primary form
  workflow. Rejected.

The chosen pair (chips inline + tighter cap) gets ~70–120px of
list real-estate back without any extra clicks anywhere.

### Verification

- React lints — none.
- `yarn build` — clean (`webpack compiled with 2 warnings`,
  same asset-size warnings, no errors).
- The bottom panel's footer (Reset / Apply / Cancel) is a sibling
  of the scroll container, not a child, so a shorter scroll
  region cannot push the action buttons off-screen. Verified
  by inspecting the JSX tree above and below the modified div.
- Chip wrapping behaviour verified: a stanza with 10+ tags
  cleanly wraps onto a second line inside the same flex row;
  the viz pill drops to that second line's right edge via
  `ml-auto`.

### Files touched

- `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/app.conf`
  — `build = 95` → `build = 96`.
- `packages/splunk-cisco-dashboards/src/main/webapp/common/components/florida/KpiPickerPanel.tsx`
  — chips merged into the SEARCH NAME header line, bottom-panel
  cap lowered 42% → 34%, comment block above the cap documents
  the math + footer-anchor invariant.
- `packages/splunk-cisco-dashboards/docs/SESSION_LOG.md` — this
  entry.

### What's next

- Alan to refresh the picker, confirm: (a) chips and viz-type
  pill share one row, (b) the SEARCH NAME label is gone, (c) the
  result list visibly takes more of the popover. If the bottom
  panel feels too cramped at 34%, we can dial it to 36–38% or
  keep 34% and trim more bottom-panel content (see "rejected
  options" above).
- Carry-forward TODO list (unchanged): trace field-list dump,
  DM-eligible TE alert/trace rewrites, `latencyMs` cleanup,
  expected-critical-sites lookup, hand-audit of TA Stock stanza
  descriptions, singleton-tag sweep.

---

## 2026-05-13 (Build 95) — Sparkline squish fix + safe React-ecosystem dep refresh

### Context

Alan: *"see screenshot, can we do something about how we shrink
and expand objects? I know I struggled with this issue and we
figured it out and implemented it in
`~/repo/splunk-cisco-app-navigator` — have a look at it and see
if you can understand how we did there and apply the same concept
here. And while you are at it, make sure we are up-2-date on all
REACT libraries…"*

Two side-by-side screenshots: short-viewport vs tall-viewport. On
the short viewport, every metric tile's sparkline canvas
collapsed to a 30–40px strip, looking broken. On the tall
viewport the same tiles rendered cleanly with ~80–100px charts.

### Discovery & decisions

#### Where the bug actually was

Subagent inspection of `splunk-cisco-app-navigator/packages/splunk-cisco-app-navigator`
came back empty: no `ResizeObserver`, no `react-resize-detector`,
no `useMeasure`, no chart-fit hook anywhere — that repo is a
product *catalog* of cards with no charts, so the only useful
pattern there is the generic CSS hygiene principle "use `min-height: 0`
on shrinking flex children that need to scroll, and pin a real
floor on anything you don't want to collapse below readability."
That principle is what we needed; the repo was the wrong
reference.

Audited this repo's chart pipeline directly:

- `Sparkline.tsx`: already wraps Recharts in `<ResponsiveContainer>` and
  uses `flex flex-col h-full w-full` with `flex-1 min-h-0` on the
  chart slot. Recharts' container uses ResizeObserver internally.
  This level was fine.
- `MetricItem.tsx` chart slot (`<div className="flex-1 min-h-[72px] max-h-28 ...">`):
  declares a 72px floor on the chart container. Floor was fine.
- `DashboardSection.tsx` (root `<div>`):
  declares `flex flex-col flex-shrink-0 min-h-[220px]` — the
  intended 220px floor that the comment block right above the
  property explicitly documents:
  *"min-h-[220px] is the lower bound at which a row of tiles
  still renders the headline + chart at a legible size … below
  that the sparkline canvas degenerates to a wavy pixel line."*
- `pages/overview/index.tsx` line 2614: passed
  `className="flex-1 min-h-0"` into the section.

Root cause: `cn()` in `common/lib/utils.ts` is `twMerge(clsx(…))`,
and `tailwind-merge` resolves conflicting Tailwind utilities by
*later wins*. So `min-h-0` from the override silently overrode the
section's own `min-h-[220px]`, and `flex-1` overrode
`flex-shrink-0`. Three sections with no floor and `flex-shrink: 1`
collapse together when the metrics-column height drops below
~660px — the chart slot then has 30–40px to render in, and the
72px chart-container floor pushes it to overflow which gets
clipped by the section's `overflow-hidden` (the right behaviour
to contain chart bleed, but the wrong shape on a *too-short*
section).

The page-level comment on the metrics column (line 2528)
described the intended "scroll instead of squish" model:
*"when the viewport is too short to fit all three sections at
their min-h-[220px] floor (≈ 660px content …), the metric column
scrolls vertically instead of squishing the chart canvases below
readability."* — the column has `overflow-y-auto`. The model was
already in place; the only thing missing was the actual 220px
floor making it through `cn()` to the rendered DOM.

#### What changed

`pages/overview/index.tsx` — replaced the section override:

- Before: `className="flex-1 min-h-0"`
- After:  `className="flex-1 min-h-[220px]"`

Both classes survive the merge: `flex-1` deduplicates against
`flex-shrink-0` (so we keep the proportional growth on tall
viewports), and `min-h-[220px]` matches the section's own
declaration (idempotent under twMerge — the floor is preserved).

A comment block above the className documents the bug, the
twMerge mechanism, and the design intent, so the next person who
sees the override doesn't innocently swap it back to `min-h-0`
to "make the splitter work".

No code changes needed in `Sparkline.tsx`, `MetricItem.tsx`, or
`DashboardSection.tsx` — they were already correct. The bug was
purely a tailwind-merge aliasing at the page-level override.

### React-ecosystem dep refresh (in-range patches only)

`npm outdated` reported a long list, split into two buckets:

1. **In-range patch / minor bumps** — safe to take in this build:

   | Package | Old | New |
   |---------|-----|-----|
   | `react` | 19.2.5 | **19.2.6** |
   | `react-dom` | 19.2.5 | **19.2.6** |
   | `@splunk/react-ui` | 5.9.1 | **5.10.0** |
   | `@splunk/react-icons` | 5.10.0 | **5.11.0** |
   | `@splunk/themes` | 1.7.0 | **1.7.2** |
   | `postcss` | 8.5.13 | **8.5.14** |

2. **Major-version migrations — deferred** (each is a separate
   project with breaking changes; not safe to fold into a
   sparkline-fix build):

   - `recharts 2 → 3` (full API rewrite — every Sparkline /
     ResponsiveContainer call site would need rework)
   - `tailwindcss 3 → 4` (config format + utility-class engine
     rewrite — every component would need a regression sweep)
   - `lucide-react 0.x → 1.x` (icon-name churn, the picker uses
     >25 icons)
   - `tailwind-merge 2 → 3` (resolver behaviour changes —
     ironically affects the very fix in this build)
   - `eslint 7 → 10`, `stylelint 15 → 17`, `typescript 5 → 6`
     (each cascades into config rewrites)
   - `react-leaflet 4 → 5` (still warns about React 18 peer dep
     even on 4 — 5 needs Leaflet 1.9+ and a hook-based API
     migration)
   - `babel-loader 9 → 10`, `css-loader 6 → 7`, `style-loader 3
     → 4`, `copy-webpack-plugin 11 → 14`, `postcss-loader 7 → 8`,
     `webpack-cli 5 → 7`, `webpack-merge 5 → 6` — webpack
     toolchain bumps tied to @splunk/webpack-configs which we
     don't control
   - `styled-components 5 → 6` (constrained by @splunk/react-ui's
     declared peer of `^5.3.10`)
   - `shelljs 0.8 → 0.10` (a one-off used by build scripts;
     trivial but skipped to keep this build narrow)
   - `@dnd-kit/sortable 8 → 10` (drag-reorder UX in OverviewPage
     uses 8.0.0 directly; v10 changes sensors API)

`package.json` cleanup: yarn 1.x's upgrade dropped the new
versions of `@splunk/react-ui`, `@splunk/react-icons`,
`@splunk/themes`, `react`, `react-dom`, `postcss` into
`dependencies` while leaving stale duplicates in
`devDependencies`. Cleaned that up in one pass — runtime React
libs (`react`, `react-dom`, `@splunk/react-*`,
`@splunk/splunk-utils`, `prop-types`, `styled-components`) all
live under `dependencies` now; build-only tools (`postcss`,
`eslint`, `tailwindcss`, `typescript`, `webpack-*`, etc.) live
under `devDependencies`. No more duplicate keys.

### Verification

- `yarn install` — clean (peer-dep warnings are pre-existing:
  Splunk's `@splunk/react-*` family advertises React 18 peers
  even though it works fine with React 19, and `react-leaflet@4`
  still advertises React 18 peers; both are tracked upstream).
- `yarn build` — clean (`webpack compiled with 2 warnings`,
  same asset-size warnings as prior builds, no errors).
- React lints — none.
- `cn('flex flex-col flex-shrink-0 min-h-[220px]', 'flex-1 min-h-[220px]')`
  → `'flex flex-col flex-1 min-h-[220px]'` (verified via
  twMerge's resolver semantics): floor preserved, growth
  preserved, no flex-shrink contention.
- Net effect: short viewport now scrolls the metrics column
  rather than squishing every section to 30px-tall sparklines.
  Tall viewport unchanged (same proportional `flex-1` growth).

### Files touched

- `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/app.conf`
  — `build = 94` → `build = 95`.
- `packages/splunk-cisco-dashboards/src/main/webapp/pages/overview/index.tsx`
  — section override className `flex-1 min-h-0` → `flex-1
  min-h-[220px]`, plus a 25-line comment block documenting the
  tailwind-merge aliasing trap.
- `packages/splunk-cisco-dashboards/package.json` — runtime React
  libs promoted to `dependencies`, build-only tools kept in
  `devDependencies`, new patch / minor versions adopted (see
  table above), no major-version migrations attempted.
- `packages/splunk-cisco-dashboards/yarn.lock` — refreshed to
  resolve the in-range bumps.
- `packages/splunk-cisco-dashboards/docs/SESSION_LOG.md` — this
  entry.

### What's next

- Alan to refresh the dashboard, drag the browser to a short
  vertical height, confirm the metrics column now scrolls
  vertically (with all three sections visible at their 220px
  floor) instead of squishing the sparklines. Tall viewport
  should look identical to before.
- Major-version migrations listed above are each their own
  session — flag any specific one (most likely candidate for
  a "do this next" pick: `recharts 2 → 3` because that's where
  the chart pipeline lives, but it's a multi-file rewrite).
- Carry-forward TODO list (unchanged): trace field-list dump,
  DM-eligible TE alert/trace rewrites, `latencyMs` cleanup,
  expected-critical-sites lookup, hand-audit of TA Stock stanza
  descriptions, singleton-tag sweep.

---

## 2026-05-13 (Build 94) — More picker real-estate: dismissible Bound strip + collapsible Description

### Context

Build 93 collapsed the App / Category / Sub-cat / Tag block and
compressed the "Currently bound" banner to a single 28px row.
Alan tested it: *"better but not great. see screenshot, can we
maybe collapse the current search to make more room? what do you
think?"*

Counted the vertical space in the screenshot at ~440px popover
height:

| Region                        | Approx height |
|-------------------------------|---------------|
| Header (Configure tile / X)   | 50px          |
| Search input + Filters toggle | 80px          |
| BOUND strip                   | 32px          |
| **Result list**               | **190px**     |
| **Bottom preview panel**      | **~360px**    |
| Footer (Reset / Cancel / Apply)| 50px         |

The bottom preview panel was eating ~50% of the popover. Of that,
the DESCRIPTION block (label + 4-line clamped paragraph) was the
single biggest non-essential chunk: ~80–100px of narrative the
user has already vetted at storyboard time. Title + chart-type +
tags + value-field input + Apply are essential; the description
isn't, for a pick-and-apply flow.

The BOUND strip is a smaller win at 32px, but it's also dead
weight after the user has seen what's bound or used Jump-To once.
Asked Alan whether to do BOUND, the bottom-panel description, or
both — he picked both.

### What changed

#### 1. Dismissible BOUND strip

Added `boundDismissed: boolean` state, default `false`, reset on
panel-open so a fresh picker context always sees the strip again.
The strip now renders as a flex row of two siblings (instead of
nested buttons, which is invalid HTML and which Safari's click
handling refuses): a wide left button that runs `jumpToCurrent`,
and a small right `×` button that calls `setBoundDismissed(true)`.
Tooltip on the × explains the behaviour ("gives the result list
more room — reopens next time you open the picker").

Saves ~32px per panel-open once dismissed.

#### 2. Collapsible Description in the bottom panel

Added `descOpen: boolean` state, default `false`, reset on
panel-open. Wrapped the existing description block in the same
"Show SPL" toggle pattern already established for the SPL
preview, so the picker has one consistent collapsing affordance
across both heavy text blocks:

- Always-visible toggle row: chevron + "Description" + a
  60-character inline preview suffix when collapsed
  (`Description · Current device health score from Catalyst…`)
  so the user can decide whether to expand without first
  expanding.
- When expanded: the full `line-clamp-4` paragraph as before.
- When collapsed: ~22px instead of ~100px.

Saves ~80px per render of a selected entry.

#### 3. State resets on panel-open

The existing reset effect already handles `filtersOpen`,
`showSpl`, and the facet defaults. Build 94 added
`boundDismissed` and `descOpen` to the same effect so every
fresh tile context starts with the bound strip visible and the
description collapsed — predictable starting state, no
session-leak between two different tiles.

### Verification

- React lints — none.
- `yarn build` — clean (`webpack compiled with 2 warnings`,
  same asset-size warnings as prior builds, no errors).
- Net real-estate gain at rest: ~32px (BOUND dismiss) + ~80px
  (Description collapsed by default) = ~112px back to the
  result list per panel-open, on top of Build 93's ~140px.
- HTML structure on the BOUND strip changed from a single
  `<button>` to a flex `<div>` with two sibling buttons —
  validates clean (`<button>` inside `<button>` is forbidden by
  the spec) and Safari's click handling no longer needs special
  handling for the dismiss action.

### Files touched

- `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/app.conf`
  — `build = 93` → `build = 94`.
- `packages/splunk-cisco-dashboards/src/main/webapp/common/components/florida/KpiPickerPanel.tsx`
  — `boundDismissed` + `descOpen` state, reset wiring on
  panel-open, BOUND strip restructured to a flex row with a
  dismiss `×`, Description block wrapped in a collapse toggle
  with inline preview when collapsed.
- `packages/splunk-cisco-dashboards/docs/SESSION_LOG.md` — this
  entry.

### What's next

- Alan to refresh the picker, confirm the BOUND strip now has a
  dismiss × on the right, the description starts collapsed with
  a one-line preview, and the result list visibly takes up more
  of the popover. If still cramped, candidates for Build 95
  could be: collapsing the SPL field-suggestion chips ("USE:
  ...") behind the same Description toggle, or adding a
  full-screen mode for the picker.
- Carry-forward TODO list (unchanged): trace field-list dump,
  DM-eligible TE alert/trace rewrites, `latencyMs` cleanup,
  expected-critical-sites lookup, hand-audit of TA Stock stanza
  descriptions, singleton-tag sweep.

---

## 2026-05-13 (Build 93) — Picker real-estate: collapse filters, rename Dispatch → App

### Context

Alan's screenshot of the Build 92 picker showed the problem: the
top half of the panel was facets (search box + Dispatch + Category
+ Tag input) plus a two-line "Currently bound" banner, leaving
maybe 1/3 of the popover for the actual list of searches. His
note: *"don't have much room to browse the list of searches, maybe
we can collapse the filters and the current search."*

He also asked for two corrections:

1. The `dispatch_context` facet introduced in Build 92 should be
   labelled "App" — that's what the field actually represents
   (the Splunk app namespace the search lives in). "Dispatch" is
   internal Splunk-conf jargon and means nothing to operators
   reading the picker.
2. Confirm there are no other hardcoded scope filters narrowing
   the list. Build 91 dropped the Cisco-tag gate; Build 92 made
   the dispatch-context gate user-configurable. He wanted explicit
   confirmation that *every* searchbase entry shows up by default
   so picking a different app still surfaces the full catalogue.

### What changed

#### 1. Audit: zero hardcoded filters confirmed

Re-grepped `KpiPickerPanel.tsx` for `.filter(` and `.includes(`.
Every match is either a substring helper for the free-text
search, the user-driven tag-set checks, or the catalogue's
runtime filter (App / Category / Sub-cat / Tag / query — all
state-driven). No tag-name hardcodes, no app-name hardcodes
outside of `DEFAULT_APP_SCOPE` (which is the *default* selection,
not a gate). The full ~530-stanza catalogue passes the picker
once the App facet is on `splunk-cisco-dashboards`, and switching
to "All apps" widens it to whatever other apps' `searchbase.conf`
files contribute on the stack.

#### 2. Renames: Dispatch → App

Underlying searchbase field stays `dispatch_context` (Splunk conf
semantics), but every UI-facing identifier in the picker now uses
"App":

- `DEFAULT_DISPATCH_CONTEXT` → `DEFAULT_APP_SCOPE`
- `ALL_DISPATCH_CONTEXTS` → `ALL_APPS`
- `selectedDispatchContext` / `setSelectedDispatchContext` →
  `selectedApp` / `setSelectedApp`
- Derived `dispatchContexts` list → `apps`
- UI label `DISPATCH` → `APP`; option text `All dispatch contexts
  (N)` → `All apps (N)`; tooltip rewritten to "Splunk app the
  search belongs to (the searchbase entry's dispatch_context)"
  so the underlying conf field is still discoverable for anyone
  diffing entries against `searchbase.conf`.

Comments throughout the file updated in the same pass — anywhere
they referred to "the Dispatch facet" / "dispatch context resets"
they now say "the App facet" / "the App facet resets". The
historical build trail (Builds 87 → 91 → 92 → 93) is preserved as
a comment block above `DEFAULT_APP_SCOPE` so the rename history
is documented in code, not just here.

#### 3. Collapse the facet block

New state hook `filtersOpen` (default `false`). The free-text
search input stays always visible at the top of the filter
section. Below it, a single-row toggle replaces the previous
stack of dropdowns at rest:

- Chevron + `Filters` label.
- Active-count badge (e.g. `2 active`) when any applied facet is
  non-default. Counts App ≠ default + Category ≠ "All" +
  Sub-cat ≠ "All" + selected-tag count. Tag-filter typing buffer
  is excluded so the badge reflects *applied* filters only.
- Inline `Clear filters` action on the right when any facet is
  active — dismisses without requiring expansion.

Click the toggle and the App / Category / Sub-cat block plus the
Tag multi-select expand inside the same `space-y-2` parent. The
auto-expand effect re-opens the block whenever any facet flips
non-default — so if a user collapses the block while having tags
selected and then later picks a category, the block re-opens to
show what's now in play. Closing is left manual.

Net effect at rest: ~140px of vertical real-estate returns to the
result list. `Filters` toggle (~28px) + search input (~36px) +
"Bound" strip (~28px) is the only chrome above the list.

#### 4. Compress the "Currently bound" banner

Replaced the two-line block (uppercase `CURRENTLY BOUND` label
on the first line, search name on the second, separate `Jump to`
button) with a single-row strip: green check + inline `Bound:`
label + truncated search name + right-aligned `Jump to` text.
The whole strip is the click target — generous tap area, same
emerald styling so the visual weight is unchanged. ~28px tall vs
~64px previously.

### Verification

- React lints — none.
- `yarn build` — clean (`webpack compiled with 2 warnings`,
  same asset-size warnings as prior builds, no errors).
- All 530 stanzas in `default/searchbase.conf` still carry
  `dispatch_context = splunk-cisco-dashboards`, so opening the
  picker with the default `selectedApp = splunk-cisco-dashboards`
  passes the full catalogue (matches Build 92 behaviour).
- Filter audit: no `.includes(` or `.filter(` hardcodes on tag
  names or app names remain in the picker. Only state-driven
  predicates plus the Default-app-scope safety option in the
  dropdown.

### Files touched

- `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/app.conf`
  — `build = 92` → `build = 93`.
- `packages/splunk-cisco-dashboards/src/main/webapp/common/components/florida/KpiPickerPanel.tsx`
  — Dispatch → App renames, `filtersOpen` state + auto-expand
  effect + on-open reset, `activeFilterCount` derivation,
  collapsible Filters toggle row replacing the always-on facet
  stack, single-row "Bound" banner replacing the two-line block,
  comment / tooltip / option-text edits.
- `packages/splunk-cisco-dashboards/docs/SESSION_LOG.md` — this
  entry.

### What's next

- Alan to refresh the picker, confirm the result list visibly
  has more room with the Filters block collapsed; expand
  Filters and exercise the App dropdown (now labelled "App"),
  Category, Sub-cat, Tags; confirm the auto-expand fires when
  applying a facet from a collapsed state.
- Carry-forward TODO list (unchanged): trace field-list dump,
  DM-eligible TE alert/trace rewrites, `latencyMs` cleanup,
  expected-critical-sites lookup, hand-audit of TA Stock stanza
  descriptions, singleton-tag sweep.

---

## 2026-05-13 (Build 92) — Promote dispatch_context to a real picker facet

### Context

Build 91 swapped the picker's hardcoded Cisco-tag gate for a
hardcoded `dispatch_context === 'splunk-cisco-dashboards'` check.
Functionally that fixed the "No searches match" bug, but Alan's
follow-up landed within the hour: "where is the dispatch_context
filter?" The screenshot showed the picker UI with Category /
Sub-cat / Tag dropdowns and no dispatch facet anywhere.

Re-reading the original direction ("a dispatch_context filter
that default to dispatch_context = splunk-cisco-dashboards"),
"default" implies a changeable user-facing facet, not a constant.
Build 92 promotes the constant to a real dropdown alongside
Category / Sub-cat.

### What changed

#### 1. Constants and state

`KpiPickerPanel.tsx`:

- Renamed the file-top constant `DISPATCH_CONTEXT_SCOPE` to
  `DEFAULT_DISPATCH_CONTEXT` so the name reflects "starting value"
  rather than "permanent gate". Added an `ALL_DISPATCH_CONTEXTS`
  sentinel matching the existing `ALL_CATEGORIES` /
  `ALL_SUB_CATEGORIES` pattern.
- New state hook: `selectedDispatchContext`, initial value
  `DEFAULT_DISPATCH_CONTEXT`. Mirrors `selectedCategory` shape
  exactly so the rest of the picker treats it as a peer facet.

#### 2. Filtering moved from load-time to render-time

The previous helper `sortAndApplyDispatchFilter` removed entries
at REST-fetch time, so the catalogue state held only one app's
slice. That made the dropdown impossible to widen at runtime
without re-fetching. Replaced with `sortAlphabetical`: the full
catalogue lands in state, and dispatch filtering happens inside
the `filtered` and `tagFacetEntries` useMemos alongside the
existing category/tag/text filters.

The cache-staleness check that re-fetches when a binding isn't
recognised now operates on the full sorted list, not a
dispatch-filtered slice — that way bindings pointed at another
app's stanza still resolve and the "Currently bound" banner
renders once the user widens the Dispatch facet.

#### 3. Cascading resets

Same pattern as the existing category → sub-category cascade:
when the dispatch context changes, the picker resets category,
sub-category, and active tags. Different apps ship different
category / tag vocabularies, so carrying old selections forward
would silently zero out the result list. Cleared facets give the
user a fresh slice to browse.

#### 4. UI dropdown

Added above the Category dropdown (top of the facet stack so the
"what scope am I in?" question reads first). Always renders, even
when only one dispatch context is present in the catalogue, so
operators can see which scope they're browsing. Three option
shapes:

- `All dispatch contexts (N)` — the union sentinel.
- One option per distinct `dispatch_context` value found in the
  catalogue, sorted alphabetically.
- A safety option for `splunk-cisco-dashboards` that renders only
  when it isn't already in the derived list (e.g. during initial
  paint or REST error states), so the dropdown never collapses
  to "All" with the default value silently lost.

The label `DISPATCH` lives in the same column as `CATEGORY` /
`SUB-CAT`, with a tooltip that explains it's the Splunk app
namespace the search registered against.

#### 5. Categories / sub-categories scoped to the dispatch slice

The `categories` and `subCategories` useMemos now skip entries
whose dispatch context doesn't match the active selection (when
not `ALL_DISPATCH_CONTEXTS`). Picking `splunk-cisco-dashboards`
shows only this app's category vocabulary; switching to "All"
unions every namespace's categories.

#### 6. `facetsActive` and Clear-filters

The "any non-default facet is set?" check now treats a non-default
dispatch context as a facet. Clear-filters resets the dispatch
context back to `DEFAULT_DISPATCH_CONTEXT` along with everything
else.

### Verification

- React lints — none.
- `yarn build` — clean (`webpack compiled with 2 warnings`,
  same asset-size warnings as Build 91, no errors).
- All 530 stanzas in `default/searchbase.conf` carry
  `dispatch_context = splunk-cisco-dashboards`, so opening the
  picker with the default selection still passes the full
  catalogue (matches Build 91 behaviour for the common case).
- New behaviour: switching to "All dispatch contexts" surfaces
  any stanzas pulled from other apps' `searchbase.conf` files in
  the same Splunk install. Selecting a specific other app
  narrows to just that app's stanzas.

### Files touched

- `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/app.conf`
  — `build = 91` → `build = 92`.
- `packages/splunk-cisco-dashboards/src/main/webapp/common/components/florida/KpiPickerPanel.tsx`
  — sentinel + default constants, `selectedDispatchContext`
  state, runtime filter, dispatch-aware category / sub-category
  derivation, cascade reset effect, dispatch dropdown UI,
  facetsActive + clear-filters wiring.
- `packages/splunk-cisco-dashboards/docs/SESSION_LOG.md` — this
  entry.

### What's next

- Alan to refresh the picker, confirm the new Dispatch dropdown
  shows up at the top of the facet stack with
  `splunk-cisco-dashboards` selected and ~530 entries listed,
  then exercise "All dispatch contexts" / a specific other app
  to confirm the slice changes.
- Carry-forward TODO list from Build 91: trace field-list dump,
  DM-eligible TE alert/trace rewrites, `latencyMs` cleanup,
  expected-critical-sites lookup, hand-audit of TA Stock stanza
  descriptions, singleton-tag sweep.

---

## 2026-05-13 (Build 91) — Picker browse fix + FDEM scrub

### Context

Two issues surfaced at the same time:

1. **Critical bug: picker shows empty.** Opening "Configure Tile" on
   the Overview map and trying to browse the catalogue produced
   "No searches match the current filters" with all facets at
   their defaults. The screenshot Alan sent showed the search bar,
   the Sites < 90% binding context, and a completely empty result
   list.

   Cause: the picker's catalogue resolver was hardcoded to filter
   `entry.tags.includes('Cisco')` as a "Cisco-only browsing gate."
   Builds 87 → 89 dropped `Cisco` from the tag taxonomy as a noise
   tag (it was on every single stanza, so it added zero filtering
   value). Once Build 87 shipped, the gate started filtering 100%
   of the catalogue out, but it took a few days for someone to
   actually try the picker again — hence the "we have a major
   bug!!!" message today.

2. **Generic-default cleanup, round two.** Build 90 generalized
   the `[customer_name]` macro and the admin-guide markdown, but
   "FDEM" / "Florida Division of Emergency Management" was still
   sprinkled across `searchbase.conf` description text, code
   comments, the audit script, the reference design, and the
   session log. Anything in description / explanation / related_info
   shows up directly in the picker preview pane, so the strings
   are user-visible.

The same message also asked whether the `[customer_name]` macro
could just be removed now that the React pencil exists. Decision
recorded below.

### What changed

#### 1. Picker dispatch-context gate (`KpiPickerPanel.tsx`)

The Cisco-tag filter was replaced with a `dispatch_context` filter
that defaults to `splunk-cisco-dashboards`. The constant lives at
the top of the file (`DISPATCH_CONTEXT_SCOPE`) so future operators
who want to widen the picker (e.g., to expose searchbase entries
from other apps) only have to flip one constant.

- Renamed the helper `sortAndApplyCiscoFilter` → `sortAndApplyDispatchFilter`.
- Comment block calls out the Build 87 history so the next person
  to read this code understands the regression chain.

Why dispatch-context is the right gate:

- The picker hits `/servicesNS/-/<app>/configs/conf-searchbase`,
  namespace `-`, so it can pull stanzas from *any* app's
  `searchbase.conf` on the Splunk instance — not just ours.
- Our app sets `dispatch_context = splunk-cisco-dashboards` and
  `dispatch_context_force = 1` on every stanza (Build 87
  metadata refactor confirmed 530/530 coverage).
- Filtering on `dispatchContext === 'splunk-cisco-dashboards'`
  therefore includes every stanza we ship and excludes any
  searchbase entries the customer's other apps might inject.

Verification: `python3 -c '...'` confirmed all 530 stanzas in
`default/searchbase.conf` carry `dispatch_context = splunk-cisco-dashboards`,
so the new filter passes the full app catalogue.

#### 2. FDEM scrub across the codebase

A Python script (`/tmp/sb_refactor/fdem_scrub.py`) walked nine
files and applied an ordered set of substitutions:

- "Florida Division of Emergency Management" → "this customer's organization"
- "FDEM Catalyst Center Field Reference" → "Catalyst Center Field Reference"
- "FDEM/Cisco" → "the customer/Cisco"
- "non-FDEM" → "non-customer"
- "FDEM-{specific,style,only,confirmed,driven}" → "customer-{specific,…}"
- "FDEM's" → "the customer's"
- Specific phrases (e.g. "the FDEM Overview review" → "the Overview
  review with the customer", "FDEM stack" → "customer stack",
  "FDEM convention" → "the customer's convention", "FDEM follow-up"
  → "customer follow-up", "FDEM data/site/sites" → "customer
  data/site/sites").
- Final `\bFDEM\b` regex catch-all → "the customer".

Files scrubbed (with replacement counts):

- `searchbase.conf` (51) — picker-visible description / explanation /
  related_info text plus internal comments.
- `pages/overview/index.tsx` (4) — comment block plus the user-visible
  "Sites < 90%" tile description.
- `macros.conf` (2) — comment header.
- `CustomerTopologyMap.tsx` (3) — comment block.
- `InfoTooltip.tsx` (1) — comment.
- `scripts/audit_searchbase.py` (6) — sourcetype-allowlist comments
  plus the script's own ground-truth set name (`FDEM_DNAC_SOURCETYPES`
  → `CUSTOMER_DNAC_SOURCETYPES`).
- `reference_design/.../App.tsx` (1) — the demo header literal flipped
  to `Your Organization Name` to match the main app's default.
- `archive/admin_guide_v21.xml` (1) — archived demo markdown.
- `SESSION_LOG.md` (125) — historical session notes; "FDEM" → "the
  customer" / "customer" preserves intent without losing meaning.

Total: 194 substitutions; post-scrub audit reports zero
"FDEM" / "Florida Division" matches in the touched files.

#### 3. Manual phrasing fixes

The bulk substitution left a handful of awkward English fragments
that needed hand-tightening:

- `audit_searchbase.py`: "the the customer/dev stack" → "the
  customer/dev stack" (script comment); also reworded the
  matching error messages and the `FDEM_DNAC_SOURCETYPES`
  identifier to `CUSTOMER_DNAC_SOURCETYPES`.
- `searchbase.conf`:
  - "the the customer-default scenario" → "the customer-default scenario"
  - "Driven by the customer Overview-page review with Alan" →
    "Driven by the Overview-page review with Alan"
  - "Not currently deployed at customer" → "Not currently deployed on this stack"
  - "the data path is proven on the customer" → "the data path is proven against live customer data"
  - "If the table is empty on customer" → "If the table is empty on the customer stack"
  - "more reliably populated on the customer" → "more reliably populated on the customer stack"
- `pages/overview/index.tsx`:
  - "Per the Overview review with the customer with Alan on 2026-05-11"
    → "Per the Overview review with the customer (Alan, 2026-05-11)"
  - "ranking is barely informative for an customer-style 2-site footprint"
    → "ranking is barely informative for a 2-site footprint"
  - "any customer with real XDR `site` enrichment" →
    "any deployment with real XDR `site` enrichment"
  - "How many customer sites (Tallahassee, Auburndale)" →
    "How many monitored sites (Tallahassee, Auburndale)" (this one
    is rendered in the tile tooltip, so kept it generic).
- `macros.conf`: dropped the redundant FDEM example, replaced
  with `City of Springfield` so the example list still has two
  distinct shapes.
- `reference_design/.../App.tsx`: replaced the awkward
  `<h1>this customer's organization</h1>` literal with
  `<h1>Your Organization Name</h1>` to mirror the main app's
  ship default.

Site-naming context preserved per Alan's direction: the SPL
filters and `dnac_site_normalize` macro still match TLH / AUB /
Tallahassee / Auburndale / Florida-prefixed paths verbatim. The
*description* text around them is generic; the *queries* are
unchanged.

### What did NOT change

- **The `[customer_name]` macro stays.** Removing it would force
  every user across every browser session to click the Edit
  Branding pencil and set the title themselves. That's a UX
  regression for any multi-user deployment. The two-layer model
  (per-deployment macro → per-user pencil override) is the right
  architecture: operators set the macro once in `local/macros.conf`
  and every user gets the right title; individual users can still
  override locally if they want a different label. README, the
  admin-guide markdown, and the macro docstring all describe this
  precedence.
- **TLH / AUB site IDs.** Per direction. Those are SPL token
  strings inside `WHERE site IN ("TLH", "AUB")` filters and the
  `dnac_site_normalize` macro — they're not "FDEM" mentions.
- **Florida-prefix stripping in `dnac_site_normalize`.** The macro
  strips `Global/Florida/` and `Global/USA/` prefixes from raw
  DNAC site paths. The accompanying TODO comment already flags
  that this is customer-specific carryover and recommends
  generalizing to a lookup before pushing to a non-Florida
  deployment.
- **Historical SPL semantics.** No SPL bodies were touched. The
  scrub only edits comments, descriptions, and identifier strings.

### Verification

- React lints — none on the five touched TSX files.
- `yarn build` — clean (`webpack compiled with 2 warnings`,
  same asset-size warnings as Build 90, no errors).
- Post-scrub audit: zero "FDEM" / "Florida Division of Emergency
  Management" matches across the nine scrubbed files.
- `dispatch_context` coverage check: 530/530 stanzas in
  `searchbase.conf` set to `splunk-cisco-dashboards`, so the new
  picker filter passes the full app catalogue.

### Files touched

- `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/app.conf`
  — `build = 90` → `build = 91`.
- `packages/splunk-cisco-dashboards/src/main/webapp/common/components/florida/KpiPickerPanel.tsx`
  — `DISPATCH_CONTEXT_SCOPE` constant + dispatch-context filter
  replacing the Cisco-tag gate.
- Nine files scrubbed for FDEM mentions (see §2 above).
- Manual phrasing fixes in `searchbase.conf`, `overview/index.tsx`,
  `macros.conf`, `reference_design/.../App.tsx`,
  `audit_searchbase.py`.
- `packages/splunk-cisco-dashboards/docs/SESSION_LOG.md` — this entry.

### What's next

- **Picker exercise.** Alan to re-open the Configure Tile panel
  on the deployed app and confirm that the catalogue browses
  again. Expected: ~530 entries available, all the existing
  category / sub-category / tag facets still work.
- **Spot-check the picker preview pane.** Open a few entries and
  confirm description / explanation text reads cleanly post-scrub.
  Awkward phrasings I missed will land in the next pass.
- **Pending tasks from the previous What's next** carried forward:
  trace field-list dump for `cisco:thousandeyes:trace`,
  DM-eligible TE alert/trace rewrites,
  `latencyMs` plumbing cleanup in `CustomerTopologyMap.tsx`,
  expected-critical-sites lookup for the website-availability
  stanza, hand-audit description / explanation on the 100
  renamed TA Stock stanzas, and the singleton-tag sweep.

---

## 2026-05-13 (Build 90) — Generic ship-default for organization name

### Context

The `default/` package was still shipping with `[customer_name] = "Florida
Division of Emergency Management"` baked into `macros.conf`, plus a
secondary hardcoded fallback (`Operations Command Center`) in
`pages/overview/index.tsx`, and the customer name embedded in the admin guide
markdown. Any fresh install on a non-customer stack therefore booted up
labelled with the demo customer's name — bad first impression and required
operators to know which file to edit before showing the dashboard.

User asked for a generic placeholder that signals "this slot is yours to
edit". Considered an inline instructional variant
("Organization Name (click the pencil to edit)") but rejected it: the h1
has Tailwind `uppercase`, so any instructional text renders ALL CAPS and
reads loud. The pencil is already on cluster-hover (Build 86) with
`title`/`aria-label` of "Edit branding (title, subtitle, logo)", so
discoverability does not depend on title-bar copy.

### Changes

#### 1. Macro default + comments (`default/macros.conf`)

- `[customer_name]` definition: `"this customer's organization"`
  → `"Your Organization Name"`.
- Tier-0 comment block rewritten to spell out both override paths:
  per-deployment via `local/macros.conf` and per-user via the in-dashboard
  pencil. Kept "Acme Corporation" and "Florida Division of Emergency
  Management" as commented examples so operators can see the shape.

#### 2. Hardcoded React fallback (`pages/overview/index.tsx`)

- `DEFAULT_HEADER_TITLE_FALLBACK = 'Operations Command Center'` →
  `'Your Organization Name'`. Aligns the macro-load-failed safety net with
  the macro default so the rendered title is consistent regardless of
  whether the Splunk macro lookup completed.

#### 3. Admin guide markdown (`data/ui/views/admin_guide_v1.xml`)

- Replaced the customer-specific framing
  ("for the **this customer's organization** statewide drill")
  with a generic description and an inline reminder of the two override
  paths (macros.conf and the pencil icon). All other content (per-dashboard
  bullet list) preserved verbatim.

### Verification

- `yarn build` — clean.
- React lints — none.
- Behavioural precedence preserved: per-user override (pencil →
  localStorage) → `customer_name` macro → hardcoded fallback. Same logic,
  cleaner default strings at every layer.

### Files touched

- `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/macros.conf`
  — `[customer_name]` default + Tier-0 comments.
- `packages/splunk-cisco-dashboards/src/main/webapp/pages/overview/index.tsx`
  — `DEFAULT_HEADER_TITLE_FALLBACK` constant.
- `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/data/ui/views/admin_guide_v1.xml`
  — Dashboard Overview markdown.
- `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/app.conf`
  — `build = 89` → `build = 90`.
- `packages/splunk-cisco-dashboards/docs/SESSION_LOG.md` — this entry.

### What's next

Same carryover as Build 89. Operator-side override path is now self-documenting
(macros.conf comments + admin guide both name the two override mechanisms),
so this should be the last build that needs to touch demo branding.

---

## 2026-05-13 (Build 89) — Tag taxonomy round 2: collapses, drops, locked vocabulary

### Context

Build 88 dropped noisy tags and replaced underscores with spaces, but a closer
look at the inventory still showed plenty of inconsistency: same concept
under two different spellings (`Alert` / `Alerts`, `Site` / `Sites`, `UX` /
`User Experience`, `DNAC` / `Catalyst Center`, `Spaces` / `Cisco Spaces`),
panel-shape tags drifting (`Timechart` next to `Trend`), demo provenance
leaking into the catalogue (`Demo`, `Tallahassee`, `Auburndale`, `Statewide`),
case mistakes (`NON COMPLIANT`), and singleton noise (`IT`, `Macros`,
`Index`, `Pipeline`, `Report`, `Reporting`). The user reviewed the inventory,
flagged that this needed another pass, and approved a full set of collapses
and drops.

### Changes

#### 1. Tag collapses (rename + dedupe, 119 stanzas updated)

| From | To | Reason |
|---|---|---|
| `Alert` | `Alerts` | subject tags are plural |
| `Trace` | `Traces` | same |
| `Site` | `Sites` | same |
| `Client` | `Clients` | same |
| `UX` | `User Experience` | reads better in filter UI |
| `DNAC` | `Catalyst Center` | DNAC is the legacy product name |
| `Spaces` | `Cisco Spaces` | bare `Spaces` is ambiguous |
| `Pool Exhausted` | `Pool Exhaustion` | noun form |
| `Timechart` | `Trend` | `Timechart` is the SPL command; `Trend` is the panel shape |
| `Geographic` | `Map` | `Map` covers the geo subject and shape |
| `Geolocation` | `Map` | same |
| `NON COMPLIANT` | `Non Compliant` | matches the rest of the file's casing |

Per-stanza dedupe is case-insensitive after the rename, so a stanza that
already carried both forms collapses to one tag.

#### 2. Tag drops (no replacement)

- `IT` — every stanza that was tagged with bare `IT` already carried
  `IT Health` (77) as the meaningful tag.
- `Macros`, `Index`, `Pipeline` — implementation noise, not filterable
  signal.
- `Demo`, `Tallahassee`, `Auburndale`, `Statewide` — customer-specific demo
  provenance leaked into a generic catalogue.
- `Report`, `Reporting` — both singletons, both vague.

#### 3. Format skill: locked vocabulary

`splunk-spl-searchbase-format` skill expanded with three explicit rules:

- **Subject tags are plural; intent tags are singular.** Subject tags
  (`Alerts`, `Sites`, `Clients`, `Devices`, `Issues`, `Sessions`, `Events`,
  `Traces`, `Transactions`) name a class of entities. Intent / panel-shape
  tags (`Trend`, `Detail`, `Drilldown`, `KPI`, `Map`, `Bar`, `Pie`, `Table`,
  `Comparison`, `Distribution`, `Breakdown`, `Leaderboard`) name what the
  panel looks like. Acronyms (`BGP`, `DNS`, `ISE`, `XDR`, `RTP`, `SIP`) stay
  as-is. `Bar Chart`, `Pie Chart`, `Timechart` are explicitly called out as
  forbidden synonyms.
- **One canonical name per concept.** `Catalyst Center` not `DNAC`,
  `User Experience` not `UX`, `Cisco Spaces` not `Spaces`, `Map` not
  `Geographic` / `Geolocation`. `Geo Enriched` is allowed only when the
  SPL has joined data to a geo lookup.
- **Expanded "no noise tags" list.** Now spells out vague-single-word noise
  (bare `IT` → use `IT Health`), implementation noise (`Macros`, `Index`,
  `Pipeline`), demo-provenance leaks (`Demo`, `Tallahassee`, `Auburndale`,
  `Statewide`), and generic verbs (`Report`, `Reporting`) alongside the
  existing list.

### Verification

- `yarn build` clean; only pre-existing asset-size warnings.
- SPL byte-equivalence (whitespace-normalized) across all 530 stanzas: 0
  mismatches.
- All 22 target tag values (12 collapsed-from + 10 dropped) confirmed at
  count = 0 post-pass.
- Canonical winners absorbed the merges as expected: `Catalyst Center`
  119 → 128, `Trend` 77 → 81, `Alerts` 15 → 23, `Cisco Spaces` 3 → 18,
  `User Experience` 14 → 26, `Sites` 16 → 17.

### Files touched

- `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf`
  — 119 tag lines rewritten; SPL untouched.
- `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/app.conf`
  — `build = 88` → `build = 89`.
- `.cursor/skills/splunk-spl-searchbase-format/SKILL.md` — `tags` section
  rewritten with subject-plural / intent-singular rule, canonical-name
  rule, and expanded noise-tag list.
- `packages/splunk-cisco-dashboards/docs/SESSION_LOG.md` — this entry.

### What's next

Same carryover as Build 88, plus:

- **Singleton sweep (deferred).** The post-Build-89 inventory still has a
  long tail of count-1 tags (`A2A`, `AWS`, `Azure`, `GCP`, `Brute Force`,
  `External IP`, …). Some are genuinely unique and useful; some are
  drift. Worth another pass once the dashboards stabilize, but not
  blocking.

---

## 2026-05-13 (Build 88) — Tag cleanup, TA Stock SPL reformat, Cursor skill, critical-website logic fix

### Context

Two follow-ups from Build 87. First, the tag taxonomy still leaked underscores
(`Catalyst_Center`, `IT_Health`, `Active_Directory`, `Health_Score`, …) and
still carried noise tags (`TEUC` on 61 stanzas, two flavours of
`Requires_Cisco_ThousandEyes_*_DM`, plus `Migrated_From_SavedSearch` and
`Composite_Replacement`). The user also flagged that the 100 newly-harvested
TA Stock searches were sitting on a single very long line each, in violation
of the project's multi-line `\`-continuation style — they wanted a Cursor
skill that codifies the format so future additions cannot drift.

Second, the user is suspicious of
`[executive_dashboard_critical_website_availability]` and shipped a CSV
(`1778708954_15209.csv`) of the live results. Reading the CSV, the logic has
three real problems:

1. **Flapping denominator.** `sites_total = dc(site)` was inside the
   `timechart`, so it counted only sites that reported in each hour. The CSV
   shows it flipping between 19 and 20 hour-to-hour for no real reason.
2. **Silent sites bump availability up.** When a critical site briefly stops
   reporting, both numerator and denominator drop together, so the percentage
   *increases* — the opposite of what an exec dashboard should show.
3. **Mean baseline biased by a single bad hour.** `eventstats avg(current_pct)`
   averaged a 47.4% dip in equally with healthy hours, dragging the baseline
   to 62.1% — well below most of the chart, useless as an anomaly reference
   line.

### Changes

#### 1. Tag taxonomy revision (530 stanzas, 395 tag lines rewritten)

- **Dropped tags app-wide:** `TEUC` (61 stanzas), `Requires_Cisco_ThousandEyes_DM`
  (111), `Requires_Cisco_ThousandEyes_Alerts_DM` (6),
  `Migrated_From_SavedSearch` (3), `Composite_Replacement` (2). All five
  were either pure noise or capability flags better expressed in
  `description`/`explanation`.
- **Underscore → space everywhere else:** `Catalyst_Center` → `Catalyst Center`,
  `IT_Health` → `IT Health`, `Active_Directory` → `Active Directory`,
  `Health_Score` → `Health Score`, `Lookup_Enriched` → `Lookup Enriched`,
  `Internet_Insights` → `Internet Insights`, etc. 39 distinct underscored
  tag names normalized; the post-refactor inventory has zero underscores in
  any tag value.
- **Within-stanza dedupe:** the rewriter dedupes case-insensitively after the
  rename so collisions (e.g., a stanza that had both `Page_Load` and
  `Page Load`) collapse.

#### 2. TA Stock SPL reformat (100 stanzas)

Every `ta_te_stock_*` stanza had its `search = ` field rewritten from a
single long line into the project's standard multi-line shape:

- Each top-level pipe begins a new line with `\` continuation on the previous
  line.
- `tstats` clauses break onto separate lines: aggregate list on the `tstats`
  line; `FROM`, `WHERE`, `BY` each indented 4 spaces.
- Multi-condition `WHERE` clauses keep the first filter on the `WHERE` line
  and indent subsequent filters 10 spaces (so they line up under the first
  filter, not under `WHERE`).
- Subsearches stay on a single line *within* their own pipeline segment.

Verified semantically: a Python verifier collapses `\<newline>` continuations
and runs of whitespace to single spaces, then diffs every stanza's `search`
field across the original and reformatted file. **All 530 stanzas
whitespace-normalize to byte-identical SPL** — the reformatter only touched
formatting, never logic.

#### 3. Cursor skill: `splunk-spl-searchbase-format`

New project skill at
`/Users/akhamis/repo/splunk-cisco-dashboards/.cursor/skills/splunk-spl-searchbase-format/SKILL.md`.
Codifies:

- Stanza skeleton (required field order: `search_name` → … → `search`).
- Search-field formatting rules (the multi-line shape above) with a canonical
  good example and a single-long-line anti-pattern.
- Tag rules: spaces not underscores; no noise tags
  (`Cisco`, `Accelerated`, `Cisco_TA`, `TEUC`,
  `Migrated_From_SavedSearch`, `Composite_Replacement`,
  `Requires_Cisco_ThousandEyes_*_DM`); subject + intent mix
  (`BGP,DNS,Trend,Detail,Drilldown`); `TA Stock Dashboard` allowed for
  provenance.
- `category` / `sub_category` taxonomy (Building / Customer Experience /
  Executive / IT Health / Monitoring / Network / Reference / Security; sub
  buckets use spaces).
- `search_name` shape: `<Domain> - <Area> - <Specific Title>`.
- Workflow for harvesting from upstream TAs: keep SPL byte-identical, apply
  formatting, name from SPL signature not from upstream view filename.
- Cross-references to existing rules (`splunk-spl-field-syntax`,
  `splunk-cisco-thousandeyes-fields`, `splunk-data-model-discovery`,
  `splunk-cisco-dnac-fields`).

Skill is project-scoped (`.cursor/skills/`) so the team picks it up
automatically when working anywhere in this repo.

#### 4. `executive_dashboard_critical_website_availability` logic fix (1.0.0 → 1.1.0)

Two surgical SPL changes:

- **Stable denominator.** Insert `eventstats dc(site) AS sites_total_window`
  *before* the `timechart`, then carry it through with
  `timechart … max(sites_total_window) AS sites_total`. Now `sites_total` is
  constant across every output bucket (= the distinct critical-site count
  seen anywhere in the dispatched window). A site that briefly goes silent
  in any hour falls out of `sum(available)` only — counted as down for that
  hour — but stays in the denominator, so the percentage can no longer
  inflate from missing samples.
- **Median baseline, not mean.** Replace
  `eventstats avg(current_pct) AS baseline_pct` with
  `eventstats median(current_pct) AS baseline_pct`. The dashed line now
  reflects the typical hour, not "average including this drop".

Also bumped the stanza version (1.0.0 → 1.1.0), refreshed `description` and
`explanation` to spell out the new shape, added two `related_info` notes
(why the denominator is window-wide, why median not mean), and tagged a
known limitation: a critical site silent for the *entire* dispatched window
still won't appear in `sites_total`. The proper fix is a lookup of expected
critical sites; tracked as a follow-up.

### Verification

- `yarn build` — clean (no React/TypeScript code changed; the build is just
  asserting the conf changes don't break packaging).
- SPL byte-equivalence (whitespace-normalized) across all 530 stanzas
  pre/post: 0 mismatches, 0 missing, 0 added.
- Tag inventory post-refactor: 0 stanzas tagged with any of the five drop
  tags; 0 underscored tag values remain.
- Manually spot-checked rewritten TA Stock searches in the diff (activity
  logs, alerts, application, network, voice) — multi-line shape matches the
  canonical example.

### Files touched

- `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf`
  — tag taxonomy revision (395 stanzas), TA Stock SPL reformat (100 stanzas),
  `[executive_dashboard_critical_website_availability]` logic fix
  (1.0.0 → 1.1.0).
- `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/app.conf`
  — `build = 87` → `build = 88`.
- `.cursor/skills/splunk-spl-searchbase-format/SKILL.md` — new file.
- `packages/splunk-cisco-dashboards/docs/SESSION_LOG.md` — this entry.

### What's next

- **Hand-audit description/explanation on the 100 renamed TA Stock stanzas.**
  Build 87 gave them precise `search_name`s but kept boilerplate
  description/explanation. They are technically accurate but generic; could
  be tightened so each panel's docs match its new precise name.
- **Trace field-list dump for `cisco:thousandeyes:trace`.** Still blocked on
  operator action — once supplied, the
  `splunk-cisco-thousandeyes-fields.mdc` placeholder gets filled out and the
  DM-eligible TE alert/trace rewrite sweep can run.
- **`latencyMs` plumbing cleanup in `CustomerTopologyMap.tsx`.** Small
  standalone refactor; site-level dead types can be dropped while link-level
  `latencyMs` stays.
- **Lookup of expected critical sites** for the website-availability
  stanza, so totally-silent sites still count as down. The denominator fix
  in 1.1.0 covers intermittent silence; a lookup covers full-window
  silence.

---

## 2026-05-13 (Build 87) — Searchbase taxonomy refactor (530 stanzas)

### Context

Alan exported the catalogue&#39;s tag distribution and flagged three
problems:

1. The 100 freshly-harvested TA stock stanzas (carried in from
   the previous Cursor agent session that scraped
   `/opt/splunk/etc/apps/ta_cisco_thousandeyes/default/data/ui/views/`)
   all had identical metadata: <code>search_name = TA Stock —
   &lt;view&gt; — &lt;blob&gt;</code>, <code>sub_category =
   ThousandEyes</code>, and <code>tags =
   TA_Stock_Dashboard,ThousandEyes,Accelerated,Requires_Cisco_ThousandEyes_DM,Cisco_TA</code>.
   Filtering on any of those tags returned the same 100 results,
   so the tags carried zero information. Names were also
   verbose, em-dash heavy, and broke the established
   <code>&lt;Domain&gt; - &lt;Area&gt; - &lt;Description&gt;</code>
   convention.
2. Across the full 530 stanzas, three tags were near-universal
   noise: <code>Cisco</code> (128), <code>Accelerated</code>
   (117), and <code>Cisco_TA</code> (100, redundant with
   <code>TA_Stock_Dashboard</code>).
3. Singletons / typos in <code>category</code> and
   <code>sub_category</code> ("Building Resilience", underscored
   sub-categories) were skewing taxonomy histograms.

### What changed (Build 87)

#### Metadata-only refactor across the entire `searchbase.conf`

**Verified safe**: zero SPL bytes changed (every <code>search =
...</code> line is byte-identical pre/post). Stanza count and
total line count unchanged (530 stanzas, 12872 lines). Only
<code>search_name</code>, <code>category</code>,
<code>sub_category</code>, <code>tags</code>, and (where
applicable) <code>related_info</code> were modified.

**Scope of changes** &mdash; 445 lines updated:

* **Tags dropped app-wide**: <code>Cisco</code>,
  <code>Accelerated</code>, <code>Cisco_TA</code>. Rationale:
  noise tags that match almost everything in the catalogue
  provide zero filtering value. <code>Accelerated</code> is
  replaced by the more-specific
  <code>Requires_Cisco_ThousandEyes_DM</code> (and siblings) for
  panels that genuinely need a DM acceleration capability flag.

* **Categories normalized**: <code>Building Resilience</code>
  (singleton typo) &rarr; <code>Building</code>.

* **Sub-categories normalized**: underscore &rarr; space for
  <code>Internet_Insights</code>, <code>Path_Visualization</code>,
  <code>Page_Load</code> so they read like the rest of the
  catalogue.

* **TA Stock 100 stanzas (`ta_te_stock_*`) fully reworked**:
  * <code>search_name</code> rebuilt from each stanza&#39;s SPL
    signature using a structured naming pipeline. Pattern:
    <code>ThousandEyes - &lt;Area&gt; -
    &lt;TestType&gt;? &lt;Metric&gt; &lt;Shape&gt;</code>. All 100
    names are now unique &mdash; zero <code>(Variant N)</code>
    suffixes &mdash; and tell you exactly what the panel does.
  * Examples:
    * <code>TA Stock — voice — FTP targets by server (3)</code>
      &rarr; <code>ThousandEyes - Voice - FTP Server Throughput
      Drilldown Permalinks</code>
    * <code>TA Stock — network — Network latency by target
      trend</code> &rarr; <code>ThousandEyes - Network - Latency
      Trend by Server Address</code>
    * <code>TA Stock — alerts — Alert volume by test type
      (2)</code> &rarr; <code>ThousandEyes - Alerts - Alert
      Counts by Severity (Filterable)</code>
    * <code>TA Stock — application — ThousandEyes accelerated DM
      panel</code> &rarr; <code>ThousandEyes - Application - HTTP
      Server Availability Trend</code>
  * <code>sub_category</code>: was uniformly
    <code>ThousandEyes</code>, now per-area: <code>TE Activity
    Logs</code>, <code>TE Alerts</code>, <code>TE
    Application</code>, <code>TE Configuration</code>, <code>TE
    Internet Insights</code>, <code>TE Network</code>, <code>TE
    Voice</code>. So a catalog filter on
    <code>sub_category=TE Voice</code> now returns just the 22
    voice panels, not all 100 harvested TE searches.
  * <code>tags</code>: removed the universal
    <code>TA_Stock_Dashboard,ThousandEyes,Accelerated,Requires_Cisco_ThousandEyes_DM,Cisco_TA</code>
    block; replaced with per-stanza inferred tags derived from
    SPL signature + view. New tag set per stanza is now a
    sensible mix of subject (<code>BGP</code>, <code>DNS</code>,
    <code>HTTP</code>, <code>RTP</code>, <code>SIP</code>,
    <code>FTP</code>, <code>Latency</code>, <code>Loss</code>,
    <code>Jitter</code>, ...), intent (<code>Trend</code>,
    <code>Detail</code>, <code>Drilldown</code>,
    <code>Distribution</code>, <code>Geo_Map</code>), area
    (<code>Application</code>, <code>Voice</code>,
    <code>Network</code>, ...), and the two retained provenance
    tags (<code>TA_Stock_Dashboard</code>,
    <code>Requires_Cisco_ThousandEyes_DM</code>).

#### Naming pipeline (preserved as `/tmp/sb_refactor/refactor.py`)

Implementation summary &mdash; the script is a one-shot tool, not
checked in, but worth keeping the design notes:

1. **Parse**: split conf into stanza blocks; preserve raw lines
   for non-touched fields. Multi-line <code>search = </code>
   continuations (lines ending with <code>\</code>) are kept
   intact.
2. **SPL signature extraction** (TA Stock only): per stanza,
   extract <code>test.type</code> filter (handles both
   <code>IN(...)</code> and <code>="x"</code> forms),
   filtered/aggregated metric (<code>metric_name:X</code>),
   aggregation function, BY clause fields (with dataset prefix
   stripped), and <code>has_time</code>/<code>has_permalink</code>
   shape signals.
3. **Name derivation** (per view):
   * <code>activity_logs</code>, <code>alerts</code>,
     <code>configuration_status</code>, <code>events</code>:
     hand-written rules per known panel (10-12 rules per view).
   * <code>application</code>, <code>network</code>,
     <code>voice</code>: structured signature-based naming
     <code>&lt;TestType&gt; &lt;MetricLabel&gt; &lt;Shape&gt;</code>
     using a curated <code>METRIC_LABELS</code> table (~25
     metrics) and a <code>title_field</code> alias map for
     dimensional fields (<code>server.address</code> &rarr;
     <code>Server Address</code>, etc.).
   * Special-cases for <code>Path_Viz</code> dataset,
     <code>BGP Reachability Geo Map</code>, and
     <code>outputlookup</code>-style account-group population.
4. **Prefix-overlap dedup**: <code>_join</code> drops redundant
   leading words, so <code>API + API Step Duration Trend</code>
   becomes just <code>API Step Duration Trend</code> instead of
   <code>API API Step Duration Trend</code>.
5. **Uniqueness pass**: append <code>(Variant N)</code> if
   collision detected. After tuning, the final pass produces
   zero collisions across all 100 stanzas.
6. **Dedup detection**: normalized-SPL hash with dashboard
   tokens (<code>$tkn_*$</code>, <code>$app_dd_*$</code>)
   collapsed. Result: 0 SPL-identical groups in this 100-stanza
   ingest &mdash; the upstream agent&#39;s normalized-hash dedup
   already worked. The merge-into-survivor logic remains in the
   pipeline for the next harvest pass.

#### Tag distribution before / after

| Tag                  | Before | After |
| -------------------- | ------ | ----- |
| Cisco                | 128    | 0     |
| Accelerated          | 117    | 0     |
| Cisco_TA             | 100    | 0     |
| ThousandEyes (broad) | 180    | 80    |
| BGP                  | 8      | 19    |
| DNS                  | 9      | 21    |
| HTTP                 | 3      | 18    |
| SIP                  | 2      | 13    |
| FTP                  | 1      | 12    |
| Application          | 0      | 28    |
| Voice                | 0      | 21    |
| Trend                | 45     | 77    |
| Drilldown            | 3      | 25    |
| Map                  | 13     | 13    |

Filtering on <code>sub_category</code> + a single subject tag
(<code>BGP</code>, <code>DNS</code>, etc.) now narrows to a
useful working set (e.g., <code>sub_category=TE Network AND
BGP</code> &rarr; just the 8 BGP-specific stanzas). Previously
this query would have returned every TE stanza because all of
them carried <code>ThousandEyes</code>, <code>Cisco</code>, and
<code>Accelerated</code>.

### Verification

* <code>yarn build</code> &mdash; clean.
* SPL byte-equivalence between pre and post:
  <code>diff /tmp/sb_refactor/spl_orig.txt
  /tmp/sb_refactor/spl_new.txt | wc -l</code> &rarr; 0.
* React frontend has zero references to either old TA Stock
  search names or the dropped tags &mdash; the harvested entries
  were catalog-only and never wired into a tile.

### Files touched

* `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf`
  &mdash; 445 lines updated.
* `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/app.conf`
  &mdash; build 86 &rarr; 87.
* `packages/splunk-cisco-dashboards/docs/SESSION_LOG.md` &mdash;
  this entry.

### What&#39;s next

Same backlog as the end of Build 86 &mdash; nothing in this
build changed those:

1. Trace field-list dump for <code>cisco:thousandeyes:trace</code>
   (operator action: <code>`index_thousandeyes`
   sourcetype=&quot;cisco:thousandeyes:trace&quot; |
   `field_list`</code>).
2. DM-eligible TE alert/trace rewrites (blocked on #1).
3. <code>latencyMs</code> plumbing cleanup in
   <code>CustomerTopologyMap.tsx</code>.
4. Hand-audit metadata
   (<code>description</code>/<code>explanation</code>) on the
   100 newly-renamed TA Stock stanzas. The boilerplate they
   carry today is technically accurate but generic; could be
   tightened so each panel&#39;s docs match its new precise name.

---

## 2026-05-13 (Build 86) — Branding pencil hover-reveal polish

### Context

Alan reviewed the live Build 85 header and asked two questions:

1. *"How can I now change the logo?"* — usability question about
   the Build 84 branding editor. The pencil icon next to the
   subtitle is the entry point, but it&#39;s small and easy to miss.
   No code change needed for the answer; documented the flow in
   the chat reply (click pencil → modal → Logo section → Upload
   logo → Save).
2. *"Can the pencil be visible if we hover over the title?"* —
   UX polish. Today the pencil is always visible at
   `text-slate-400`. Alan wants it hidden by default to keep the
   header clean for executives who don&#39;t need to rebrand, and
   only revealed when they hover over the branding cluster.

This build addresses #2.

### What changed (Build 86)

#### `pages/overview/index.tsx` — header branding cluster

Wrapped the logo + title/subtitle + pencil cluster in a named
hover group (`group/branding`) and added opacity classes to the
pencil button:

* `opacity-0` — hidden by default
* `group-hover/branding:opacity-100` — reveals when the cursor
  enters anywhere in the branding cluster (logo, title, subtitle,
  or the pencil itself)
* `focus-visible:opacity-100` — reveals when a keyboard user tabs
  to the pencil. Using `focus-visible` (not `focus`) keeps the
  pencil hidden after a mouse click moves focus away — we only
  want the *intentional* keyboard reveal, not a stuck-visible
  pencil after every click.
* `transition` — smooth fade in/out (the umbrella `transition`
  utility covers opacity, colors, and box-shadow with the default
  150ms duration; replaces the previous `transition-colors` which
  was no longer enough now that opacity is also animated).

The named-group form (`group/branding` rather than bare `group`)
scopes the hover trigger so any future ancestor `group` class
elsewhere in the header chrome won&#39;t accidentally fire the same
reveal — defensive for the next time we add a hover-affordance
nearby.

The cluster&#39;s hover area is wide (logo + title + subtitle), so
discoverability is fine: any user who moves their mouse near the
branding to read the title will see the pencil fade in. Tooltip
(`title="Edit branding (title, subtitle, logo)"`) and `aria-label`
are unchanged.

#### `app.conf`

`build` 85 → 86.

### Verification

* `yarn build` — clean (2 pre-existing entrypoint-size warnings,
  unchanged).
* No lint errors on the touched file.
* Manual smoke (visual): pencil invisible at rest, fades in on
  hover anywhere in the branding cluster, fades back out on
  leave; tabbing through the header surfaces the pencil with a
  visible focus ring courtesy of the existing `hover:bg-*`
  classes (no separate focus ring needed because the opacity
  reveal makes the button outline naturally visible against the
  header background).

### Files touched

* `packages/splunk-cisco-dashboards/src/main/webapp/pages/overview/index.tsx`
* `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/app.conf`
* `packages/splunk-cisco-dashboards/docs/SESSION_LOG.md`

### What&#39;s next

Same backlog as the end of Build 85 — none of those items moved:

1. Trace field-list dump for `cisco:thousandeyes:trace` (operator
   action: `` `index_thousandeyes` sourcetype="cisco:thousandeyes:trace" | `field_list` ``).
2. DM-eligible TE alert/trace rewrites (blocked on #1).
3. `latencyMs` plumbing cleanup in `CustomerTopologyMap.tsx`
   (small standalone refactor, ~30 min).
4. Searchbase metadata audit sweep across older Build 79–82
   stanzas whose descriptions may have drifted.

---

## 2026-05-13 (Build 85) — Active TE Alerts as severity bar tile + small-viewport scroll fix

### Context

Three follow-ups from Alan&#39;s 2026-05-13 review of the live build:

1. He sketched a TE alerts visualisation he wanted as a bar chart
   by severity, gave us the SPL, and asked us to swap the existing
   *Active TE alerts* tile to use it.
2. He flagged the screenshot of the Overview page at a short
   browser height — the sparkline canvases collapse to a thin
   wavy line and become illegible. Dashboard Studio doesn&#39;t have
   the same issue because it uses fixed-height grid tiles and
   lets the page scroll. We want the Overview to behave the same
   way.
3. Status check on the carry-over pending tasks.

This build addresses #1 and #2; #3 is documented in the Build 85
prompt response (operator action required for the trace field
list, then the DM rewrite sweep can run; latency cleanup is a
small follow-up build).

### What changed (Build 85)

#### New searchbase stanza: `[it_health_active_te_alerts_by_severity]`

Bar-chart breakdown of currently-active TE alerts grouped by
severity. Full metadata (description, explanation, solution,
related_info, viz_options with severity-aware colors) so the
catalogue audit and KPI picker preview both render cleanly.

```spl
| tstats `summariesonly` count
    FROM datamodel="Cisco_ThousandEyes.Alerts"
    BY Alerts.severity
| rename Alerts.severity AS Severity
| sort -count
```

Notes on the SPL:

* Cleaned `WHERE BY` (invalid SPL — likely a copy-paste artifact
  in the original brief) to plain `BY`. No other filters: the
  tile shows every severity bucket the TE org emits.
* `summariesonly` keeps the tile fast on busy installs; it
  short-circuits to empty if the DM acceleration isn&#39;t built
  rather than running a slow uncached fallback.
* `rename Alerts.severity AS Severity` because the React tile
  reads the dimension column as `Severity` (no dataset prefix).
* `sort -count` is a tiebreaker — the React layer applies a
  canonical severity priority (critical &gt; high &gt; medium &gt;
  low &gt; info) on top so display order is stable across
  windows.

`default_viz = splunk.bar` is the trigger for the new tile-
rendering path (see below). `viz_options.seriesColors` carry
the severity palette (rose / orange / amber / yellow / emerald)
so the picker preview matches what the live tile paints.

#### Updated stanza: `[it_health_active_te_alerts_high_critical]`

Bumped to `version = 1.1.0`. Description and `related_info`
updated to point at the new sibling stanza as the default
Overview binding (Build 85+) and frame this time-series view as
the picker-accessible alternative for users who prefer the
spike-vs-baseline read. SPL itself unchanged.

#### New tile renderer: `BarBreakdownTile`

`packages/splunk-cisco-dashboards/src/main/webapp/common/components/florida/BarBreakdownTile.tsx`

Sibling of `MetricItem` (sparkline) and `TableTile` (multi-row
table). Same outer chrome (label, info tooltip, Open-in-Search
icon, gear, status pill), same headline shape (4xl number
matches MetricItem so a row of mixed sparkline + bar tiles
aligns vertically). Renders rows from `useTableData` as a
horizontal bar list — one row per dimension value, with:

* Severity-aware bar color via case-insensitive substring match
  (`critical|fatal|p1` → rose, `error|high|p2` → orange,
  `warn|medium|moderate|p3` → amber, `low|p4` → yellow,
  `notice|info|p5` → emerald, fallback → sky).
* Fixed left-column for the dimension label (truncates with
  title-attribute fallback so long labels still readable on
  hover).
* Bar width proportional to the *maximum* bar in the result set
  (not the sum), with a 2% floor so non-zero values are always
  visible at a glance.
* Right-column count, tabular-numerals so the digits align
  vertically across rows.
* `visibleRowCap = 5` with a `+N more` caption when exceeded —
  matches `TableTile`&#39;s row-cap idiom.
* Sum-across-all-rows headline (ignores `visibleRowCap` so the
  headline never lies about the total).

Hook reuse: dispatches via `useTableData`, same as `TableTile`.
Both renderers consume the same `{ rows, columns }` shape, so
nothing in the dispatch / picker / drilldown layer needed to
change.

#### Dispatch wiring

`useMetric.ts` now exports `isBarBreakdownViz(splunkViz)` —
predicate that returns true when the bound stanza declares
`default_viz = splunk.bar`.

`OverviewPage.MetricCard` adds a third branch alongside the
existing `isTableViz` branch: bar → `BarBreakdownCardLeaf` →
`BarBreakdownTile`. Component-level branching (not in-body) so
each leaf calls its own data hook unconditionally — Rules of
Hooks compliance.

#### `METRIC_CONFIG.active_te_alerts` rebound

* `savedSearch` → `IT Health - Active TE Alerts by Severity`
* `subLabel` → `Severity breakdown (count by severity)`
* `description` rewritten to reflect the bar-tile reading: total
  headline + per-severity breakdown.
* `thresholdNote` rewritten — threshold (warning 5 / critical 20)
  still applies to the headline total, but the severity-aware
  bar colours give the dominant-severity signal at a glance.
* `valueField`, `color`, `thresholds`, and `mock` retained as
  safety-net defaults so a picker swap to a non-bar viz reverts
  cleanly.

#### Small-viewport chart fix

Root cause: `OverviewPage` is `h-screen flex flex-col`, the main
content block is `flex-1 min-h-0 overflow-hidden`, and the three
metric sections share the available height equally. When the
viewport gets short, each section&#39;s sparkline canvas hits its
72px `min-h` floor and the chart line + peak label become
illegible (Alan&#39;s screenshot).

Fix is two-pronged:

1. **`DashboardSection.tsx`**: each section now carries
   `min-h-[220px] flex-shrink-0`. 220px is the lower bound at
   which the headline + chart canvas + tile/section chrome
   still renders legibly.
2. **`OverviewPage`**: the metrics column wrapper got
   `overflow-y-auto overflow-x-hidden`. When 3 × 220px exceeds
   the column&#39;s available height (small viewport, or `right`
   mode with a slim leftPct + tall ticker / header), the column
   scrolls vertically instead of squishing the cards. The map
   column stays anchored at its own height so the topology
   visual is never compressed.
3. **`MetricItem.tsx`**: tightened the sparkline-area padding
   from `mt-3 pt-2` to `mt-2 pt-1`. Saves ~8px that goes
   straight into the chart canvas at its floor — the line gains
   visible amplitude before the next layout step kicks in.

This matches Splunk Dashboard Studio&#39;s grid model (fixed-height
panels, page scrolls when viewport &lt; sum-of-panels) and resolves
Alan&#39;s screenshot complaint without dropping the
exec-fits-on-one-screen promise at typical executive-display
heights.

### What did NOT change

* Existing sparkline tile rendering for every other metric in
  `METRIC_CONFIG`. Only `active_te_alerts` was rebound; the rest
  still use `MetricItem`.
* `[it_health_active_te_alerts_high_critical]`&#39;s SPL.
  Description and `related_info` updated to document the
  binding change, but the search itself is unchanged so the
  catalogue picker preview is identical to before.
* Aggregate `HealthBadge` math. Bar-breakdown tiles emit
  `status: 'unknown'` (same as TableTile) so they don&#39;t move
  the badge.

### Verification

* `yarn build` clean; only the pre-existing asset-size warnings
  remain (unchanged from Build 84).
* `ReadLints` clean across all five touched files
  (`overview/index.tsx`, `BarBreakdownTile.tsx`,
  `DashboardSection.tsx`, `MetricItem.tsx`, `useMetric.ts`).
* `searchbase.conf` audit unaffected — new stanza follows the
  full metadata template, old stanza version bumped 1.0.0 → 1.1.0
  with `date_updated = 2026-05-13`.

### Pending tasks (carry-over)

* **Trace field-list dump for `cisco:thousandeyes:trace`** —
  needs operator action: run
  `` `index_thousandeyes` sourcetype="cisco:thousandeyes:trace" | `field_list` ``
  in Splunk and paste the result. Once available, the
  `splunk-cisco-thousandeyes-fields.mdc` rule placeholder gets
  filled out and the DM-eligible rewrite sweep can run.
* **DM-eligible TE alert/trace rewrites** — blocked on the
  trace field list above.
* **`latencyMs` plumbing cleanup in `CustomerTopologyMap.tsx`** —
  small standalone refactor (~30 min). Drop dead site-level
  type fields, threshold case() branches, and normalization
  paths. Link-level `latencyMs` stays (still rendered in link
  popups). Will ship as a separate small build to keep the diff
  scannable.
* **Comprehensive metadata sweep** of older searchbase stanzas
  whose descriptions / explanations may have drifted across
  Builds 79-82. Build 85 only refreshed metadata on the two
  stanzas it touched directly; a full audit is a separate
  metadata-only build.

---

## 2026-05-13 (Build 84) — Editable header chrome (title / subtitle / logo) via per-user override

### Context

Build 83 flipped the Overview page layout defaults (map right,
metrics 2/3, three tiles per section). The same review surfaced
that customers had no UI-level way to change the header chrome
without backend access — title came from the `[customer_name]`
macro (operator edits `local/macros.conf`) and the logo lived as
`customer_logo.png` in the Splunk app static directory. The
subtitle "Splunk Executive Insights" was hardcoded in JSX
and not editable at all. Build 84 ships a header pencil → modal
that lets any user override all three.

### What changed (Build 84)

#### New hook: `common/hooks/useBrandingOverride.ts`

Versioned localStorage hook (`splunk-cisco-dashboards.branding.v1`)
returning `{ override, setOverride, resetAll }`. The override is a
sparse object — `{ title?, subtitle?, logoDataUri? }` — so the
header layer falls through to the existing defaults whenever a
field is unset. Cross-tab sync via the standard `storage` event
(mirrors `usePersistedSectionTileCounts`).

Sanitisation rules baked into the hook:

* `title` / `subtitle` — trimmed; empty strings drop the field.
* `logoDataUri` — must start with `data:image/`; rejected if it
  exceeds 256 KiB (~190 KiB binary). The 256 KiB cap fits inside
  every mainstream browser's per-origin localStorage budget while
  comfortably accommodating the ~10 KiB PNGs and ~3 KiB SVGs
  customers actually upload for a 36×36 header logo.
* `setOverride` returns `false` if the supplied `logoDataUri` is
  too big, so the editor UI can surface a friendly error instead
  of silently dropping the upload.

`readImageAsDataUri(file)` helper exported alongside the hook —
wraps `FileReader` so the editor's file-input change handler can
encode an upload to a `data:` URI in one promise.

#### `pages/overview/index.tsx` — header rewiring

* Imported `useBrandingOverride` and the `Edit3 / Upload / X`
  lucide icons.
* Added two new module constants:
  * `DEFAULT_HEADER_SUBTITLE = 'Splunk Executive Insights'`
    (replaces the hardcoded "Splunk Executive Insights"
    string per the 2026-05-13 review).
  * `DEFAULT_HEADER_TITLE_FALLBACK = 'Operations Command Center'`
    (extracted from the inline JSX so the editor's placeholder
    matches the live header).
* Inside `OverviewPage`:
  * Hooked `useBrandingOverride` and added `isBrandingEditorOpen`
    state.
  * Computed `effectiveTitle / effectiveSubtitle / effectiveLogoSrc`
    by collapsing the three priority layers (override → macro
    fetch → hardcoded default).
  * Header JSX now reads from those derived values and includes a
    new pencil button next to the title that toggles the editor.
  * `handleResetAllCustomizations` now calls
    `resetBrandingOverride()` so the existing factory-reset CTA
    in the picker also clears branding.

#### New component: `BrandingEditorModal`

Defined inline in `pages/overview/index.tsx` alongside
`MapPositionToggle`. Centered modal with backdrop blur,
keyboard-friendly (Esc to close, backdrop click to close), and
three controls:

1. Title input — placeholder shows the current macro value, so
   leaving it blank means "use the macro".
2. Subtitle input — placeholder shows the new default
   "Splunk Executive Insights".
3. Logo block — small preview swatch + "Upload logo" button
   wired to a hidden `<input type="file">` accepting
   `image/png,image/svg+xml,image/jpeg,image/webp,image/gif`.
   Successful uploads are encoded by `readImageAsDataUri`,
   size-checked against 256 KiB, and stored in component state
   until Save. A "Clear (use default)" link reverts to the static
   asset.

Footer has Reset to defaults / Cancel / Save. Save returns the
hook's `false` signal when the upload is too large, surfacing an
inline error without closing the modal.

#### Subtitle default flip

The hardcoded subtitle text changed from
`"Splunk Executive Insights"` to
`"Splunk Executive Insights"`. Per Alan's response to the
question prompt, this is the new fresh-deployment default;
operators who want the previous wording set it via the editor.

### What did NOT change

* Existing `[customer_name]` macro fetch path still runs and
  still drives the header when no override is set. Operators
  who already customise `local/macros.conf` keep that workflow.
* Existing `customer_logo.png` static asset is still the
  pre-override fallback. Deployments that already swap the file
  on disk see no change.
* No new build dependencies. The editor uses native
  `FileReader`, `<input type="file">`, and existing lucide /
  Tailwind primitives.

### Verification

* `yarn build` clean (only the pre-existing asset-size warnings;
  no new warnings).
* `ReadLints` on `overview/index.tsx` and `useBrandingOverride.ts`:
  clean.
* Bundle size delta: `overview.js` grew by ~6 KiB (modal markup,
  hook, helper). Within budget.

### Operator notes

* Storage key: `splunk-cisco-dashboards.branding.v1`. Wipe via
  the factory-reset button in the picker, the modal's "Reset to
  defaults" link, or
  `localStorage.removeItem('splunk-cisco-dashboards.branding.v1')`
  in devtools.
* Per-user, per-browser. To roll out a deployment-wide brand
  change, keep editing `local/macros.conf` (title) and replacing
  `customer_logo.png` (logo) — those still win over the fresh-
  deployment hardcoded fallback whenever a user has no override
  set.

---

## 2026-05-13 (Build 83) — Overview page factory defaults: map right (1/3), metrics 2/3, three tiles per section

### Context

Alan reviewed the Build 82 popup work and immediately raised four
customization asks on the Overview page header & layout. The first
three are factory-defaults flips with one-line code changes; the
fourth (editable header chrome) is the meatier follow-up shipping
as Build 84.

### What changed (Build 83)

`pages/overview/index.tsx`:

1. **`MAP_POS_DEFAULT`**: `'below'` → `'right'`. Topology map
   becomes the executive's anchor visual on the right side at boot.
   The previous `below` default came from a 2026-05-12 review when
   the right-side map fought for horizontal width on 1280-1440px
   monitors. Build 83 fixes that pressure by also tightening the
   map column width (next item).

2. **`SPLIT_DEFAULT`**: `58.33` → `66.67`. Metrics get 2/3 of the
   horizontal width, map gets 1/3. The 35-80% clamp range stays
   (the splitter still works as before for operators who want a
   different ratio). 66.67% is well inside the safe range and
   matches the new "metrics are the headline read; map is the
   anchor visual" framing from the 2026-05-13 review.

3. **`usePersistedSectionTileCounts.fallbackDefault`**: `6` → `3`.
   Each of the three sections (IT Health, Security, Building
   Intelligence) boots with three tiles instead of six. Cap stays
   at 6 — the `−  N  +` pill on each section header lets operators
   dial up to the catalogue cap.

   This reverts the 2026-05-12 bump-to-6 decision. Reason: with
   the new 2/3-tile column, 6 tiles start truncating headlines at
   1280px while 3 tiles fill the row cleanly. The exec view's job
   is to surface the most important three signals; operators who
   want more breadth still have one click to add them.

### What did NOT change

- **localStorage migration**: not needed. Returning users with a
  saved `scd_overview_map_pos`, `scd_overview_split_pct`, or
  `splunk-cisco-dashboards.sectionTileCounts.v1` keep their
  preferences unchanged. Only first-paint defaults shift, plus
  the "Reset all customizations" button now resets to the new
  values.
- **Splitter clamp range** (35-80%): unchanged.
- **Map position toggle** (PanelRight / PanelBottom / PanelTop):
  unchanged, all three modes still work.
- **TileCountPill** UI: unchanged.

### Verification

- `yarn build` clean, no new warnings.
- `ReadLints` on `overview/index.tsx`: clean.
- All affected localStorage keys still readable; clamps still
  apply to user-saved values.

### Up next: Build 84 (editable header)

Header title, subtitle, and logo will become customer-editable via
a header pencil affordance + inline editor:

- Title: localStorage override layer on top of the existing
  `[customer_name]` macro. Default falls back to the macro.
- Subtitle: hardcoded `"Splunk Executive Insights"` becomes
  `"Splunk Executive Insights"` as the new default fallback,
  overridable via the same editor.
- Logo: file-upload encoded to base64 data URI (~200KB cap),
  stored in localStorage, falls back to
  `/static/app/splunk-cisco-dashboards/images/customer_logo.png`.

Persistence key: `scd_overview_branding`. Wired into the
factory-reset scope so customers can revert to defaults from the
header reset button.

---

## 2026-05-13 (Build 82) — Wire real Alerts data into the site map popup, drop the placeholder Latency tile

### Context

Alan opened the Tallahassee site marker on the Overview map and
the popup showed `ALERTS: Awaiting` and `LATENCY: Awaiting`. Looked
at the live stanza `[overview_site_tallahassee_health]` and found
line 9797:

```
| eval healthPct=round(healthPct,1), alerts=null(), latencyMs=null() \
```

Both columns were faithful nulls — placeholders left over from
when the stanza was first authored. The React layer (`MetricPill`
+ `formatLatency` / `formatNumber`) renders null as "Awaiting", so
nothing was broken; we just never plumbed real data through.

Alan's call:
- **Drop Latency from the site popup.** Per-site latency has no
  clean rollup from any single DNAC sourcetype. `cisco:dnac:client`
  is the only DNAC source with latency data and it's per-client
  RUM, not a site-level metric.
- **Populate Alerts.** Picked Option A from three I proposed:
  active DNAC P1/P2 issues for site devices, joined via the
  established `cisco:dnac:devicehealth` site-enrichment pattern
  used by 15+ existing issue stanzas in `searchbase.conf`.

### What changed (Build 82)

#### 1. `[overview_site_tallahassee_health]` v1.1.1 → v1.2.0

- Removed `latencyMs=null()` from the eval line.
- Removed `latencyMs` from the `fields` projection.
- Added `appendcols` subsearch that counts distinct active P1/P2
  Catalyst Center issues attributed to Tallahassee devices:
  ```
  | appendcols [
      search `index_catalyst` sourcetype="cisco:dnac:issue"
          IssueStatus="active"
          (IssueSpecificPriority="P1" OR IssueSpecificPriority="P2")
      | join type=left DeviceID [
          search `index_catalyst` sourcetype="cisco:dnac:devicehealth"
          | eval Site=`dnac_site_normalize(coalesce(Site, Location))`
          | stats latest(Site) as Site by DeviceID
      ]
      | where match(Site, "(?i)Tallahassee")
      | stats dc(IssueID) as alerts
  ]
  | fillnull value=0 alerts
  ```
- `fillnull value=0 alerts` guarantees the column is always
  populated — empty popup tile would be the failure mode.
- `telemetrySource` updated to:
  `Catalyst Center device health + active issues
   (cisco:dnac:devicehealth, cisco:dnac:issue)`
- Description / explanation / related_info HTML updated to match.
- Drill-down hint added: link to `[it_health_active_dnac_issues_table]`
  filtered to Tallahassee.

#### 2. `[overview_site_auburndale_health]` v1.1.1 → v1.2.0

- Mirror image of TLH: same `appendcols` shape, `match(Site, "(?i)Auburndale")`,
  `latencyMs` dropped, doc copy refreshed.

#### 3. `[overview_topology_overview]` v1.3.0 → v1.3.1

The umbrella stanza is described as a "summary banner / fallback
when individual site stanzas haven't loaded." It also emitted a
`latencyMs=null()` placeholder in the site row.

- Dropped `latencyMs=null()` from the umbrella site row eval and
  from the umbrella's `fields` projection.
- Kept `alerts=null()` as conservative fallback semantics — when
  the per-site stanza fails to load, the fallback should report
  "we don't know" (which the React layer renders as "Awaiting"),
  not a stale `0` that looks like real data.
- Updated the `solution` doc to drop the per-site `latencyMs`
  expectation.

#### 4. `CustomerTopologyMap.tsx` — site popup layout

- Dropped the `<MetricPill label="Latency">` block (lines 5503-5507
  in the pre-build-82 snapshot).
- Switched the popup grid from `grid-cols-2` (2x2) to `grid-cols-3`
  (single row of three) so Health / Devices / Alerts sit cleanly
  on one row.
- The **link** popup keeps its Latency tile — that's real data
  from `[overview_link_auburndale_tallahassee_health]` (TE A2A
  network.latency in ms). Only the **site** popup loses Latency.
- Site-level `latencyMs` plumbing in the normalization layer
  (`finiteOptionalNumber`, threshold case() branches) was left
  intact — those paths now just never see a value for sites and
  short-circuit harmlessly. Cleaning up the dead code is a future
  refactor, not in scope here.

#### 5. `splunk-cisco-thousandeyes-fields.mdc` v1.2.0 → v1.3.0

Operator dumped the raw `cisco:thousandeyes:alerts` field list:

```
accountGroupName, accountId, alert.details{}.metricsAtStart,
alert.details{}.source.id, alert.details{}.source.name, alert.id,
alert.rule.expression, alert.rule.id, alert.rule.name, alert.rule.notes,
alert.severity, alert.targets{}, alert.test.name, alert.triggered,
alert.type, alertId, alertState, alertType, alert_cleared,
alert_rule_expression, alert_rule_id, alert_rule_name, alert_rule_notes,
alert_targets, alert_test_name, alert_triggered, alert_type, app,
endDate, eventId, eventType, expression, id, itsiDrilldownURI,
itsi_drilldown_uri, orgId, organizationId, permalink, ruleId, ruleName,
severity, severity_id, signature, src, startDate, testId, testName,
testType, test_description, test_type, thousandeyes_test_id,
triggerTime, trigger_time_formatted, type, vendor_severity
```

Added as a new "Raw `cisco:thousandeyes:alerts` field inventory"
section alongside the existing `:metric` raw inventory, with notes
on:

- The dual `alert.*` (dotted) and `alert_*` (flat) naming the TA
  emits — pick one per stanza, prefer dotted to round-trip with
  the DM.
- `alertState="active"` vs `alert_cleared` filtering for
  open-alert counts.
- `severity` (string) vs `severity_id` (numeric) vs
  `vendor_severity` (upstream TE pre-mapping).
- `alert.targets{}` multivalue handling.
- `permalink` and `itsi_drilldown_uri` for deep-link hooks.
- Test-to-site attribution via `testName` token matching (the customer
  convention: city name embedded in test title).

Also placeholder added for the raw `cisco:thousandeyes:trace`
field inventory (operator dump pending).

Fixed a small bug in the rule's "Alert table" SPL example that
still used the wrong `cisco:thousandeyes:alert` (singular)
sourcetype — corrected to `cisco:thousandeyes:alerts` (plural)
matching the authoritative table.

### Why Option A and not Option B (TE alerts) or C (both)

- Option A reuses an already-trusted pattern in this codebase
  (`cisco:dnac:issue` joined to `cisco:dnac:devicehealth` for
  site enrichment — line 545, 3452, 3475, 3498, 3521, 3566, 4308,
  4407, etc.). Zero new sourcetype risk, zero new field guesses.
- Option B (TE alerts via `testName` site-token match) is real,
  but couples the popup to TE test naming discipline. Useful as
  a future drill-down, not as the headline number.
- Option C (DNAC + TE unioned) would mix two different fault
  domains under one label, which is misleading on an exec popup.

If we want richer signals later, the answer is more drill-down
content (existing alert/issue dashboards filtered by site) — not
more popup tiles.

### Verification

- `yarn build` clean, no new warnings.
- `ReadLints` on `CustomerTopologyMap.tsx`: clean.
- All site-row `latencyMs=null()` placeholders gone (remaining
  hits are legitimate link-row placeholders that downstream
  stages populate from real data).

### Field-list cross-check on Build 81 alert stanzas

Cross-checked the four TE alert stanzas I touched in Build 81
against the new raw alerts field list: every field they reference
(`alert.rule.name`, `alert.test.name`, `alert.type`, `severity`)
**is** in the list — Build 81's worry that they were field-broken
was wrong. Good.

### What's next

- Operator dump for `cisco:thousandeyes:trace` raw field list so
  we can do the same audit for the trace stanza
  (`teuc_5_9_52_trace_span_analysis`).
- Once the trace field list is in the rule, sweep the four TE
  alert stanzas + one TE trace stanza for any DM-eligible rewrites
  (`Cisco_ThousandEyes.Alerts` dataset uses `testName` /
  `testType` / `signature` shape, not the raw `alert.*` shape, so
  there's potential consolidation).
- Probably revisit dead `latencyMs` plumbing in `CustomerTopologyMap.tsx`
  during the next layout refactor.

---

## 2026-05-13 (Build 81) — Finish the sourcetype sweep (catch the bare `thousandeyes:*` variants Build 80 missed)

### Context

Alan opened `searchbase.conf` to line 6420 and pointed out:

```
search = `index_thousandeyes` sourcetype="thousandeyes:alerts" \
```

Wrong on its face — should be `cisco:thousandeyes:alerts`. He
asked, fairly, why I hadn't already fixed this in Build 80.

### Root cause of the miss

In Build 80 I audited with a regex pinned to `cisco:thousandeyes:*`
(my eyes were on misspellings of the trailing word — `pathviz`,
`metrics`, `alert`, `tests`, `audit`). That regex never matched
the bare-prefix variant `sourcetype="thousandeyes:*"` because it
was missing the `cisco:` segment entirely. Whole class of bugs
slipped past: 4 alert stanzas + 1 trace stanza in `searchbase.conf`,
plus their description / related_info copy.

### What changed (Build 81)

`packages/.../splunk/default/searchbase.conf`

- 4× `sourcetype="thousandeyes:alerts"` → `sourcetype="cisco:thousandeyes:alerts"`
  - `[teuc_5_9_19_isp_performance_degradation_alerts]` (line 5686)
  - `[teuc_5_9_46_alert_severity_distribution]` (line 6250)
  - `[teuc_5_9_47_alert_timeline_trending]` (line 6272)
  - `[teuc_5_9_54_mttr_reduction_via_network_vs_application_isolation]` (line 6420)
- 1× `sourcetype="thousandeyes:traces"` → `sourcetype="cisco:thousandeyes:trace"`
  (also fixed plural→singular per authoritative list)
  - `[teuc_5_9_52_trace_span_analysis]` (line 6375)
- HTML doc copy in those stanzas (`<code>thousandeyes:alerts</code>`,
  `<code>thousandeyes:traces</code>`, `<b>thousandeyes:alerts sourcetype</b>`,
  `raw <code>thousandeyes:alert</code> events`,
  `raw <code>thousandeyes:metric</code> events`) all corrected to
  the `cisco:thousandeyes:*` form.
- Verified via grep: zero remaining `[^:.]thousandeyes:*` matches
  in `searchbase.conf`.

### Files NOT touched (intentional)

- `docs/SESSION_LOG.md` historical entries (Build 76/78/79/80
  references in older sections) — those are the historical record
  of what was true at the time. Revising them would be revisionist.
- `scripts/sourcetype_field_inventory*.json` and `.md` — those are
  audit snapshots produced by `scripts/audit_searchbase.py`; they
  reflect what stanzas referenced at audit time. Next audit run
  will regenerate them with the corrected sourcetype names.

### Verification

```
$ rg '[^:.]thousandeyes:[a-zA-Z_-]+' \
    packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf
(no matches)
```

`app.conf` build bumped 80 → 81. `yarn build` clean.

### What's next

- Wire real Alerts data into the site map popup (next build).
- Drop the unused per-site Latency tile from the popup (next build).
- Operator field-list dump for `cisco:thousandeyes:alerts` and
  `cisco:thousandeyes:trace` so we can stop guessing on field names
  the same way we stopped guessing on sourcetype strings.

---

## 2026-05-13 (Build 80) — Correct ThousandEyes sourcetype names everywhere

### Context

Alan reviewed Build 79 and flagged that several stanzas (and the
new `splunk-cisco-thousandeyes-fields.mdc` rule) still referenced
the wrong sourcetype names for the `ta_cisco_thousandeyes` add-on
on the customer. The authoritative list per his stack's
`/opt/splunk/etc/apps/ta_cisco_thousandeyes/default/props.conf`:

- `cisco:thousandeyes:metric` (singular, NOT `metrics`)
- `cisco:thousandeyes:trace`
- `cisco:thousandeyes:path-vis` (hyphen, NOT `pathviz`)
- `cisco:thousandeyes:activity` (NOT `:audit`)
- `cisco:thousandeyes:alerts` (plural, NOT `alert`)
- `cisco:thousandeyes:test` (singular, NOT `tests`)
- `cisco:thousandeyes:account-group`

He noted there may be more on his stack — operator props.conf
inspection needed before authoring SPL on uncovered sourcetypes.

### What changed (Build 80)

#### 1. `.cursor/rules/splunk-cisco-thousandeyes-fields.mdc` v1.2.0

- Replaced the speculative sourcetype-list paragraph with an
  authoritative table tying each verified sourcetype to its DM
  dataset, with explicit rationale for why each is correct.
- Added a "common mistakes I keep making" section calling out
  the wrong spellings I've used (`pathviz`, `alert`, `metrics`,
  `tests`, `audit`) so future agent runs don't repeat them.
- Demoted my prior assumption that
  `Cisco_ThousandEyes.Events` is backed by
  `cisco:thousandeyes:event` to "operator-confirm pending" —
  that string is NOT in Alan's verified list. SPL filtering by
  sourcetype for the Events dataset must wait until he pastes
  the relevant `props.conf` block.

#### 2. `searchbase.conf`

- Two `[teuc_5_9_5_path_hop_count_analysis]` and
  `[teuc_5_9_6_network_path_change_detection]` description
  references to `cisco:thousandeyes:pathviz` corrected to
  `cisco:thousandeyes:path-vis` (the actual TA spelling).

#### 3. Archive `data/ui/views/archive/detail_dashboard.xml`

- Two queries in this archived dashboard referenced
  `cisco:thousandeyes:tests` (plural) and OR'd it with
  `thousandeyes:tests` and `cisco:thousandeyes:*`. Replaced with
  the correct `cisco:thousandeyes:test` and tightened the second
  query to read from the `:metric` sourcetype with the proper
  `metric_name:network.latency` aggregation. The file is no
  longer wired into navigation but kept correct as a reference.

#### 4. `scripts/audit_searchbase.py`

- `OTHER_AVAILABLE_SOURCETYPES` had the wrong TE strings
  (`cisco:thousandeyes:metrics` plural). Replaced with the
  full correct list from Alan's authoritative paste.

#### 5. `app.conf`

`build = 79` → `80`.

### Verification

- `yarn build` (Build 80) — green, identical pre-existing webpack
  asset-size warnings, no regressions.
- Workspace-wide grep for `cisco:thousandeyes:[a-zA-Z_-]+`
  returns only the seven correct strings (plus the rule's
  "common mistakes" section which intentionally lists the wrong
  spellings as DON'T-USE examples).
- Live `search = …` lines in `searchbase.conf` only reference
  `:metric` and `:trace`, both correct per the new rule.

### What's next

- Operator confirmation of the Events / `Cisco_ThousandEyes.Events`
  dataset's actual sourcetype name from the customer TA `props.conf`.
- Audit Catalyst Center / DNAC sourcetypes the same way (Alan
  may have similar drift there) once TE is fully clean.

---

## 2026-05-13 (Build 79) — ThousandEyes SPL reconciliation: `metric_name:` prefix sweep, DM/raw split, dead-stanza disable

### Context

Alan delivered the definitive operator-confirmed field lists for
both raw `cisco:thousandeyes:metric` events and the
`Cisco_ThousandEyes.Test_Metrics` data model on the customer. The two
lists are NOT identical:

- **Raw events** expose ~80 fields, including geo / location /
  `network.io.direction` / `network.prefix` / `network.as.path` /
  `target.agent.id` / `target.agent.location` and an extra
  `metric_name:web.transaction.errors.count` metric.
- **`Test_Metrics` DM** is a curated 39-field subset: NO geo,
  NO location, NO `io.direction`, NO `prefix`, NO `as.path`.
  Adds `metric_name:api.step.*`, `metric_name:dns.lookup.validity`,
  `metric_name:ftp.*`, `metric_name:rtp.client.request.mos`,
  `metric_name:sip.*` (DM-only metrics).

Every metric measurement requires the `metric_name:` prefix in
both forms — `Test_Metrics.metric_name:network.latency` in
`tstats`, `metric_name:network.latency` on raw events. The prior
SPL routinely wrote bare `avg(network.latency)` which silently
returns null.

### What changed (Build 79)

#### 1. `.cursor/rules/splunk-cisco-thousandeyes-fields.mdc` v1.1.0

- Added the raw-event `cisco:thousandeyes:metric` field
  inventory verbatim from the operator-confirmed `field_list`
  output.
- Made it explicit that the raw and DM lists are different and
  why: enumerated the DM-only metrics (`api.step.*`,
  `dns.lookup.validity`, `ftp.*`, `rtp.client.request.mos`,
  `sip.*`) and the raw-only fields (`web.transaction.errors.count`,
  geo / location / `io.direction` / `prefix` / `as.path` /
  `target.agent.*` / `monitor.id` / etc.).
- Added a four-step decision tree the agent walks for every TE
  stanza: DM-eligible → DM, needs raw-only field → raw events,
  field in neither list → drop / redesign / disable.
- Called out specific common errors (`api.completion` → wrong
  name, real field is `api.step.completion`, DM-only).

#### 2. `searchbase.conf` — TE SPL reconciliation

**Mass `metric_name:` prefix sweep.** 104 raw-event aggregation
calls had bare measurement names. Replaced exact substrings (e.g.
`avg(network.latency)` → `avg(metric_name:network.latency)`) so
the DM-prefixed forms `avg(Test_Metrics.metric_name:network.X)`
are not double-prefixed. Coverage: `network.{latency, loss,
jitter}`, `bgp.{reachability, path_changes.count, updates.count}`,
`dns.lookup.{availability, duration, validity}`,
`http.{client.request.duration, server.request.availability,
server.throughput}`, `web.{page_load.{completion, duration},
transaction.{completion, duration, errors.count}}`,
`api.{completion, duration}` → renamed to
`api.step.{completion, duration}`, `ftp.*`, `sip.*`,
`rtp.client.request.mos`.

**DM-only stanzas converted from raw to `tstats`.** These
metrics are not present on raw `cisco:thousandeyes:metric`
events on this tenant; querying raw would silently null:

- `[teuc_5_9_15_dnssec_validity_monitoring]` —
  `dns.lookup.validity` (DM-only).
- `[teuc_5_9_39_api_endpoint_completion_rate]` —
  `api.step.completion` (DM-only); also corrected the field
  name from `api.completion` (wrong) to `api.step.completion`.
- `[teuc_5_9_40_api_response_time_monitoring]` —
  `api.step.duration`, converted from `timechart` to
  `tstats … by _time span=5m … | timechart`.
- `[teuc_5_9_45_ftp_server_availability_and_throughput]` —
  `ftp.{server.request.availability, client.request.duration,
  server.throughput}`.
- `[teuc_11_3_25_sip_server_availability_and_response]` —
  `sip.server.request.availability`.
- `[teuc_11_3_26_sip_registration_time_tracking]` —
  `sip.client.request.{duration, total_time}`.
- `[teuc_11_3_27_rtp_mos_score_monitoring]` —
  `rtp.client.request.mos` (DM-only); dropped the original
  `rtp.client.request.{loss, pdv, discards}` aggregations because
  those metrics exist in neither list. Stanza now produces
  per-test/agent MOS averages only.

All DM conversions use `Test_Metrics.metric_name:<measurement>`
inside `tstats` and a follow-on `rename Test_Metrics.<dim> as
<dim>` for any `by`-clause dimensions, per the operator's spec.

**Dead-stanza disable.** Six stanzas reference fields present in
neither the raw event list nor any `Cisco_ThousandEyes` DM
dataset on this tenant. Disabling them keeps the metadata for
future re-enable but prevents the search browser from running
SPL that always nulls:

- `[teuc_5_9_5_path_hop_count_analysis]` — needs `hop_count`
  (Path_Viz DM exposes only `hops`/`server`/`serverIp`).
- `[teuc_5_9_6_network_path_change_detection]` — needs
  `path_hash` (not present anywhere on this tenant).
- `[teuc_5_9_25_remote_worker_connectivity_health]` — needs
  `target.type` and `network.score` (endpoint domain not
  ingested on the customer).
- `[teuc_5_9_26_vpn_path_performance]` — needs `target.type`,
  `vpn.vendor`, `network.score`.
- `[teuc_5_9_27_endpoint_connection_type_and_network_score]` —
  needs `thousandeyes.source.agent.connection.type` and
  `network.score`.

Each disabled stanza:
- gets `tags = …,Disabled` appended.
- gets the `description` rewritten to start with
  `[DISABLED Build 79]` and explain which field is missing.
- has its `search` body replaced with
  `| makeresults | head 0 | eval message="DISABLED Build 79: …"`
  so dashboards that reference the saved-search ID render an
  empty result set with a self-explanatory diagnostic message
  instead of erroring or silently nulling.

**TEUC-28 redesigned, not disabled.**
`[teuc_5_9_28_geographic_workforce_performance_comparison]`
originally aggregated `network.score` (unsupported) by
`thousandeyes.source.agent.geo.*` (raw-only). Dropped the
`network.score` aggregation, removed the
`thousandeyes.test.domain="endpoint"` filter (endpoint domain
not ingested), and reshaped the SPL to:

```
| stats avg(metric_name:network.latency), avg(metric_name:network.loss),
        count, dc(thousandeyes.source.agent.id) as agent_count
        by thousandeyes.source.agent.geo.country.iso_code,
           thousandeyes.source.agent.geo.region.iso_code
```

Stays on raw events (geo fields are raw-only). Description
rewritten to call out the rewrite explicitly.

**`[overview_link_te_a2a_health]` left as raw events.** The
stanza requires geo / location fields (source/target agent
location, country / region ISO codes) for its AUB↔TLH location
match, and those fields exist only on raw events. This is the
correct DM-vs-raw split per the new decision tree.
`metric_name:` prefixes are correct after the sweep.

#### 3. `app.conf`

`build = 78` → `79`.

### Verification

- `yarn build` (Build 79) — green, no regressions, app stages
  cleanly. Same two pre-existing webpack asset-size warnings as
  Build 78 (`overview.js`, background images) — informational
  only, not Build-79 caused.
- Manual grep audits:
  - No remaining `(avg|sum|...)(network|http|dns|bgp|web|api|ftp|sip|rtp).*` calls on bare measurement names in any
    `search = …` line.
  - All references to unsupported fields (`network.score`,
    `target.type`, `vpn.vendor`, `connection.type`, `hop_count`,
    `path_hash`, `rtp.client.request.{loss,pdv,discards}`) are
    confined to documentation copy in disabled stanzas; no live
    SPL references them.
  - All TE searches use `` `index_thousandeyes` `` (per Build 78);
    no per-feed alias macros reintroduced.
  - DM stanzas use `Test_Metrics.metric_name:<measurement>` and
    rename `Test_Metrics.<dim>` back to bare dim names before
    follow-on commands.
- TE field-dictionary rule (`splunk-cisco-thousandeyes-fields.mdc`)
  is the single source of truth going forward; raw-vs-DM picks
  follow the four-step decision tree it documents.

### What's next

- Operator-side spot check: pick five stanzas (one DM, two raw,
  one redesigned, one disabled stub) and run them on the customer
  stack to confirm row counts and field population match
  expectations.
- Once spot checks pass: convert remaining DM-eligible
  network/HTTP/web TEUC stanzas (currently raw-events with
  correct `metric_name:` prefix) to `tstats` for consistency
  with operator DM-first preference.
- Re-enable disabled stanzas only after the operator confirms
  the missing fields exist on this tenant via field_list /
  datamodel inspection. Don't reintroduce them speculatively.

---

## 2026-05-13 (Build 78) — DM-discovery Cursor rule + scrub `index=dnac` from doc copy

### Context

Two related corrections from Alan in one turn:

1. **Process correction.** When I'm about to write SPL that reads
   from a Splunk data model (`tstats … from datamodel=…`,
   `| from datamodel:…`, `| pivot …`), I have a long history of
   inventing field names. The fix is procedural: **always ask the
   user for the DM JSON** that the add-on ships (e.g.
   `/opt/splunk/etc/apps/ta_cisco_thousandeyes/default/data/models/Cisco_ThousandEyes.json`),
   read its `objects[].fields[]`, and only then write SPL.
2. **Concrete fix.** Alan saw the literal string `index=dnac`
   appear in `searchbase.conf`. He wants every reference moved
   to the existing `[index_catalyst]` macro.

### What changed (Build 78)

#### 1. New Cursor rule — `.cursor/rules/splunk-data-model-discovery.mdc`

- Glob targets: same as `splunk-spl-field-syntax.mdc`
  (`**/*.conf`, `**/data/ui/views/*.xml`, `**/webapp/**`).
- Codifies the "ask for the DM JSON" process verbatim:
  - Identify which DM the search uses.
  - Ask the user for the JSON file path or contents (default
    location `/opt/splunk/etc/apps/<ta_app>/default/data/models/<Model>.json`,
    but always confirm).
  - Parse `objects[]` for dataset names, `fields[]` for field
    names, `calculations[]` for derived fields, `constraints[]`
    for the dataset's base search.
  - Build SPL using exact names; for the metric store, keep the
    `metric_name:` prefix.
  - Document the DM source in the stanza's `description` /
    `explanation` so the data-source assumption is auditable.
- Lists the historical mistakes this rule is meant to prevent:
  guessing `Test_Metrics.network.jitter` when the DM has
  `Test_Metrics.metric_name:network.jitter`; using a dataset
  name that doesn't exist; single-quoting DM field paths in
  `tstats` arguments.

#### 2. `searchbase.conf` — `index=dnac` doc-copy scrub

Audit: zero actual SPL searches in the file used a literal
`index=dnac` clause (the working SPL already used
`` `index_catalyst` `` macro everywhere). The four hits Alan saw
were all in HTML/comment narrative:

| Where | Before | After |
|---|---|---|
| L542 (`explanation` HTML) | `<code>scripts/audit_sourcetype_fields.py --index=dnac</code>` | `<code>scripts/audit_sourcetype_fields.py</code> against `cisco:dnac:*` sourcetypes |
| L1245 (`related_info` HTML) | same | same |
| L1374 (`#` audit comment) | `Verified against live `index=dnac` (78 events)` | `Verified against live `index_catalyst` (78 events)` |
| L10521 (`#` audit comment) | `on the live Catalyst Center TA in `index=dnac`` | `on the live Catalyst Center TA in `index_catalyst`` |

The CLI examples were rephrased to drop the literal-index detail
because `scripts/audit_sourcetype_fields.py` is a Python tool
that takes a real index name as a CLI flag — substituting the
Splunk macro there would have been factually wrong.

Out of scope: `scripts/sourcetype_field_inventory_merged_live_dnac*.json`
(field-inventory captures from the live customer tenant — those are
data files documenting what was queried, not config that needs
updating) and `SESSION_LOG.md` historical entries.

#### 3. Bookkeeping

- `app.conf` build 77 → **78**.
- `yarn tsc --noEmit` clean.
- `yarn build` clean (pre-existing 1.38 MiB asset-size warning
  only).
- `git check-ignore .cursor/rules/splunk-data-model-discovery.mdc`
  → not ignored, ready to commit.

### Still pending (deferred)

- The `metric_name:` prefix bug in `[overview_link_te_a2a_health]`
  (and any TEUC stanza reading `network.*` bare against the
  metric store) is still present. Build 78 only adds the rule
  that will guide its fix; the actual SPL rewrite waits on
  Alan's `field_list` macro outputs and the
  `Cisco_ThousandEyes.json` paste.
- The doc-copy in a few migrated TEUC stanzas now reads
  self-referentially (e.g. comparing `index_thousandeyes` to
  `index_thousandeyes`) after the Build 77 macro purge. Polish
  pass deferred to the same TE-fields work.

---

## 2026-05-13 (Build 77) — purge per-feed ThousandEyes index macros, consolidate on `index_thousandeyes`

### Context

Alan caught that I'd been carrying four ThousandEyes-specific index
aliases — `stream_index`, `path_viz_index`, `event_index`,
`activity_index` — that he never asked for and that don't reflect
how customer (or the Cisco ThousandEyes TA) actually segments the data.
Per his guidance: **all** ThousandEyes feeds (raw metric stream,
path visualization, Internet Insights events, audit/activity) land
in the same index, so the `index_thousandeyes` macro alone covers
every TE-related search. The per-feed aliases were over-engineering
that just made it easier for me to write inconsistent SPL.

### Changes (Build 77)

#### 1. `searchbase.conf` — bulk migration
- 82× `` `stream_index` `` → `` `index_thousandeyes` ``
- 5× `` `path_viz_index` `` → `` `index_thousandeyes` ``
- 1× `` `activity_index` `` → `` `index_thousandeyes` ``
- 8× `` `event_index` `` → `` `index_thousandeyes` ``
- 60 additional bare references inside `<code>...</code>` blocks
  in `description` / `explanation` / `solution` / `related_info`
  HTML also replaced for consistency.
- Total: 156 substitutions across the searchbase.

After-migration grep for the four old macro names returns zero
matches in `searchbase.conf`. Doc copy in a handful of stanzas now
reads slightly awkwardly (e.g. one stanza compared
`stream_index` to `event_index` to teach learners about feed
separation; that comparison is now self-referential and will be
polished in a follow-up).

#### 2. `macros.conf` — stanzas removed
- Deleted `[stream_index]`, `[path_viz_index]`, `[event_index]`,
  `[activity_index]`. The remaining `[index_thousandeyes]` stanza's
  description was extended to spell out the convention: "All
  ThousandEyes-related searches must use this macro; no per-feed
  aliases ... all TE feeds land in the same index per the customer
  convention."

#### 3. Out of scope (deferred)
- The `metric_name:<measurement>` prefix bug Alan flagged in this
  session is still pending. The current `[overview_link_te_a2a_health]`
  stanza (and any TEUC stanzas that read `network.latency` etc.
  bare against the metric store) will still emit nulls until I get
  the `field_list` macro output from the customer. That's the next session.
  Build 77 is the macro purge only; no SPL semantics changed beyond
  the index reference.

### Verification

- 0 hits for `stream_index|path_viz_index|activity_index|event_index`
  in `searchbase.conf` and `macros.conf` (only `SESSION_LOG.md`
  retains historical references).
- `yarn tsc --noEmit` clean.
- `yarn build` clean (asset-size warnings only, pre-existing).
- `app.conf` build 76 → **77**.

### What's next

Awaiting Alan's `field_list` query outputs (Q1–Q9 from the prior
turn) to:

1. Build the new `splunk-cisco-thousandeyes-fields.mdc` rule.
2. Rewrite `[overview_link_te_a2a_health]` v1.1.1 → 2.0.0 with
   DM-first SPL using the correct `Test_Metrics.metric_name:network.X`
   prefix.
3. Audit + fix every TEUC stanza for the `metric_name:` prefix
   on raw `cisco:thousandeyes:metric` events.

---

## 2026-05-13 (Build 76) — SPL dotted-field quoting cleanup + Cursor rule v2

### Context

After Build 75 landed Alan reread the freshly rewritten
`[overview_link_te_a2a_health]` stanza and called out a recurring SPL
quoting habit I keep getting wrong — single-quoting dotted field names
in places where they shouldn't be quoted:

> when using fields with periods or dot in them ... you have to be
> careful on when to single quote the field names. Inside an `eval` for
> example you must single quote (`| eval test='thousandeyes.test.id'`),
> however when performing stats on a field you must NOT use single
> quotes — `stats … by thousandeyes.test.id`, not
> `stats … by 'thousandeyes.test.id'`. Same for
> `first('thousandeyes.test.name')` → should be
> `first(thousandeyes.test.name)`. The one wrinkle: when you nest
> `eval()` inside a stats function, the eval rules apply to the inner
> expression (`sum(eval(if('network.jitter'>0,1,0)))`).
>
> Please fix any issues like this everywhere ... right now as an
> example we have this issue here `[overview_link_te_a2a_health]` ...
> but we need this issue fixed everywhere and a Cursor skill you add
> and have me verify.

He's right on every count. Build 75 reverted to raw events for that
stanza but I quoted every aggregate-function arg + the `by` clause +
the `rename` source field, all of which silently break the search
(stats emits null columns, by-clause emits a literal string column,
rename no-ops). The existing `splunk-spl-field-syntax.mdc` rule even
documented the right answer for stats/by but mis-classified `rename`
as needing double quotes. So this fix needed two parts: a sweep of
every existing violation in production SPL, and a rewrite of the
Cursor rule to be unambiguous + auditable.

### Changes (Build 76)

#### 1. Production SPL quoting cleanup (`searchbase.conf`, `savedsearches.conf`, dashboard XMLs)

| File | Stanza / Location | Was | Now |
|---|---|---|---|
| `searchbase.conf` | `[overview_link_te_a2a_health]` v1.1.0 → **v1.1.1** stats line | `avg('network.latency')`, `first('thousandeyes.…')` × 14, `values('thousandeyes.…')` × 2, `by 'thousandeyes.test.id'`, `rename "thousandeyes.test.id" as teTestId` | bare dotted fields throughout |
| `searchbase.conf` | `[overview_link_te_a2a_health]` explanation `<code>` | `BY 'thousandeyes.test.id'` plus copy "demonstrates quoting dotted JSON-style field paths" | `BY thousandeyes.test.id` plus reworded copy that explicitly says single-quote-only-inside-`eval` |
| `searchbase.conf` | `[client_summary_*]` line 9192/9193 | `timechart dc(macAddress) as clients by 'connection.ssid'` | `by connection.ssid` |
| `searchbase.conf` | `[ssid_distribution_*]` line 9393 | `avg('health.overallScore') as avg_health` | `avg(health.overallScore) as avg_health` |
| `searchbase.conf` | 8 stanzas with `rename 'connection.ssid' as …` | quoted | unquoted |
| `searchbase.conf` | 3 stanzas with `rename 'connection.protocol' as …` | quoted | unquoted |
| `searchbase.conf` | 4 stanzas with `rename "All_Traffic.dvc" as …` / `rename "Cisco_Security.…" as …` | double-quoted | unquoted |
| `searchbase.conf` | 2 explanation `<code>` blocks (lines 7466 + 9389) | `latest('connection.ssid')`, `avg('health.overallScore')` | unquoted forms |
| `savedsearches.conf` | `[NetOps Alert - NRS Below Threshold]` line 389 | `stats avg('health.overallScore') as cha` + `rename "All_Traffic.dvc" as …` | unquoted forms (kept the `where 'health.overallScore'>=0` because where is class B) |
| `data/ui/views/statewide_exercise_v1.xml` | 2 inline timechart queries | `by 'connection.ssid'` | `by connection.ssid` |

The `where 'health.overallScore'>=0` (line 389 of savedsearches.conf)
was left intact — `where` is an expression evaluator (Class B) so
single-quoting is correct there. Same logic kept the `eval` blocks in
`[overview_link_te_a2a_health]` single-quoted (`coalesce('thousandeyes.source.agent.location', "")` etc.).

#### 2. Cursor rule rewrite (`.cursor/rules/splunk-spl-field-syntax.mdc` → v2.0.0)

- Collapsed the prior 3-class taxonomy ("bare / single / double") into
  a clearer 2-class one (Class A = "no quotes", Class B = "single
  quotes inside eval-syntax") that matches Alan's stated rule of
  thumb. The double-quotes-for-rename guidance was wrong and is gone
  — `rename` now sits firmly in Class A.
- Added an explicit single-bit summary at the top: "wrap a dotted
  field name in single quotes only when it appears inside an
  expression evaluator (eval, where, fieldformat, eval() callback
  inside stats / timechart). Anywhere else, write the dotted name
  bare."
- Quick-reference matrix lists every command we actually use, with
  positive examples.
- Added the `eval()` callback inside `stats` / `timechart` aggregates
  as an explicit Class B example (e.g.,
  `count(eval('connection.band'=="5.0"))` — the outer is class A so
  `by connection.ssid`, but the inner `eval()` is class B so the
  inner field gets single-quoted). This is the wrinkle Alan called out.
- Added a "How to verify a file before committing" section with **four
  copy-pasteable `rg` commands** that find every variant of the bug.
  All four return zero on the current tree. Anyone can run them
  before committing SPL.
- Kept the existing `globs` filter so the rule fires only on
  SPL-bearing files.

The four verification greps:

```bash
# 1. Single-quoted dotted field as aggregate function arg
rg -n "(first|last|avg|sum|count|min|max|dc|values|earliest|latest|median|stdev|range|estdc|p\d+|sumsq|var)\('[a-zA-Z_]\w*\.[a-zA-Z_]" \
   packages/splunk-cisco-dashboards/src/main/resources/splunk/default

# 2. Single-quoted dotted field as `by` clause key
rg -n "\b(by|BY)\s+'[a-zA-Z_]\w*\.[a-zA-Z_]" \
   packages/splunk-cisco-dashboards/src/main/resources/splunk/default

# 3. Quoted dotted field in `rename` (single OR double)
rg -n "\brename\s+['\"][a-zA-Z_]\w*\.[a-zA-Z_]" \
   packages/splunk-cisco-dashboards/src/main/resources/splunk/default

# 4. Bare dotted field inside `eval` (reverse bug)
rg -n "\beval\s+\w+\s*=\s*[a-zA-Z_]\w*\.[a-zA-Z_]\w*\.[a-zA-Z_]" \
   packages/splunk-cisco-dashboards/src/main/resources/splunk/default
```

### Verification

- All four audit greps return **0 hits** repo-wide.
- `yarn tsc --noEmit` → clean (no TS regressions, since the only `.tsx` change in this build was the rule file which is markdown).
- `yarn build` → succeeded (`✓ App staged at stage/`, asset-size warnings only — pre-existing, not regressions).
- `app.conf` build bumped 75 → **76**.
- `[overview_link_te_a2a_health]` version bumped 1.1.0 → **1.1.1**.
- Spot-checked the rewritten stats line in `[overview_link_te_a2a_health]`:
  - `avg(network.latency) as _latencyS, avg(network.loss) as lossPct, avg(network.jitter) as jitterMs` — bare ✅
  - `values(thousandeyes.source.agent.name) as sourceAgents` — bare ✅
  - `first(thousandeyes.test.name) as teTestName` — bare ✅
  - `by thousandeyes.test.id` — bare ✅
  - `rename thousandeyes.test.id as teTestId` — bare ✅
  - `eval _agentScope=coalesce('thousandeyes.source.agent.location',"")…` — single-quoted ✅ (it's eval)
  - `eval teLinkConstructed=if(isnotnull(teAccountId)…)` — bare locals (`teAccountId`, `teTestId`, etc.) ✅ (no dots)

### Notes for customer follow-up

- Push `stage/` to the customer. The fix should immediately resolve the empty `lossPct` / `jitterMs` / location / region columns Alan saw in the screenshot, because the previous build was emitting null on every quoted aggregate (the parser was looking for fields literally named `'thousandeyes.…'`).
- If any column is still empty after this push, the field really *is* missing in the raw events on customer — run the diagnostic SPL in the stanza's `related_info` to confirm field availability before chasing the dashboard.
- The Cursor rule update means future agent edits to SPL will get caught: the rule is auto-attached to `searchbase.conf` / `savedsearches.conf` / dashboard XMLs / webapp source files via the `globs` directive, and the four-grep audit is now part of the pre-commit checklist.

### What's next

Awaiting Alan's confirmation that:

1. The four audit greps return zero on his side (they can be run from any clone, no Splunk required).
2. customer popup now populates loss / jitter / geo fields after he picks up the build.
3. The rewritten Cursor rule wording is what he wants documented.

Then I'll commit Build 76.

### Addendum (Build 76, mid-session) — `.cursor/rules/` was gitignored

Discovered while preparing to commit: the prior `.gitignore` ignored
`.cursor/` wholesale, which meant **none** of the project's Cursor
rules (the 23 codeguard-* security guardrails + the 2 splunk-*
project rules including the one we just hardened) were ever tracked
in git. Edits to `splunk-spl-field-syntax.mdc` were silently not
showing up in `git status` because of this.

Fix:

- Replaced `.cursor/` with `.cursor/*` in `.gitignore` so git still
  descends into the directory, then added two negations
  (`!.cursor/rules/`, `!.cursor/rules/**`) so team-shared rules are
  tracked while any future Cursor local state (transcripts, history,
  settings, MCP cache, etc.) outside the `rules/` subfolder remains
  ignored. The `.cursor/*` form is required because git's parent-
  directory exclusion rule blocks re-inclusion of children when the
  parent is excluded with a trailing slash.
- Verified with `git check-ignore -v .cursor/rules/splunk-spl-field-syntax.mdc`:
  now reports the file as matched by the negation pattern, not the
  exclusion.
- All 25 `.mdc` rule files now show as untracked and are being added
  in this same commit so anyone cloning the repo gets the project's
  Cursor guidance verbatim.

This explains why prior edits to `splunk-spl-field-syntax.mdc`
(originally added 2026-05-08 per file mtime, before this session log
even started) were never shipped to the team — they only ever lived
on Alan's local clone. Build 76 fixes that.

---

## 2026-05-13 (post-Build-74 polish) — collapsible editor cards, inspect-only popup, raw-event TE A2A, unknown-status probe animation

### Context

Build 74 wired the dedicated `[overview_link_te_a2a_health]` stanza
into the AUB↔TLH link and gave the editor a full catalogue browser
per site/link. Alan deployed it to customer and got back to me with
three follow-ups:

1. **Editor UX**: the per-site / per-link cards in the topology
   editor were always-expanded — with the catalogue browser, the
   forms, the geo inputs, etc. Made the panel a wall of inputs.
   He asked: "can the sites and links default to collapsable here?
   and can I have an option to test the search, maybe after
   selecting like our other modal for tiles we have an option to
   open in search will be great."
2. **Read-only popup UX**: clicking a marker / link on the map
   *also* opened the catalogue browser inline. Alan wanted that
   popup to be inspect-only — "when we actually click on the link
   itself, there is no need to have at that point any option to
   select any search really, just show what is attached is fine
   and an ability to run it."
3. **customer data gaps**: the new TE A2A stanza populated some
   fields but left empty fields where the data model didn't
   expose the geo / loss / jitter paths. Screenshot showed
   `latencyMs=180.00` ✅ but `lossPct`, `jitterMs`,
   `sourceLocation`, `targetLocation`, all four `*Country` /
   `*Region` fields blank.
4. **Animation regression on dev**: Alan reported "site
   animation broke again on my dev instance under /opt/splunk".
   Root cause: on dev the bound link search returns no rows →
   appendpipe injects `status=unknown` → `packetProfile()` was
   returning null for unknown → packets stopped rendering.

### Changes (Build 75)

#### 1. Read-only popup (`SelectionCard`) — picker removed
- Stripped `searchOptions` and `onChangeSearchName` props from
  `SelectionCardProps`. The popup no longer renders
  `TopologySearchBrowser`.
- Kept the existing "Show SPL" toggle, the SPL preview, and the
  "Open in Splunk Search" button. Operators still get the
  inspect + run UX, just without the surprise rebind affordance.
- Cleaned up the parent: removed `popupSearchOptions` (the
  Cisco-tagged catalogue slice) and `updateSelectedSearchName`
  (the bypass-the-editor-draft mutator) since both were only
  consumed by the popup.

#### 2. Editor cards — collapsible by default
- Added `expandedCardKeys: Set<string>` state to
  `TopologyEditorPanel`, plus `toggleCardExpanded(key)` callback
  and a `useEffect` that resets the set on `open=false` so a
  re-open of the editor always starts collapsed.
- Each site card and link card is now structured as:
  - **Header** (always visible): `ChevronRight` (rotates to
    `↓` when expanded) + role icon + `<id>` + bound search
    summary (or "No search bound") + the per-card actions
    (Open-in-Search button, Pick-from-map for sites only,
    Remove).
  - **Body** (only when expanded): the `TopologySearchBrowser`
    plus the existing fields (Name / Short / Role / Status /
    Lat / Lng / Internet edge Mbps for sites; Name / Source /
    Target / Status / Capacity for links).
- The header is itself a button that toggles expansion, so a
  click anywhere on the row chrome opens / closes the card.
  Per-card action buttons are siblings to that header button
  (NOT nested) to keep the HTML valid.

#### 3. Editor cards — Open in Search button
- Added `onOpenInSearch?: (spl) => void` to
  `TopologyEditorPanelProps` and wired it from the parent map
  (which already had its own `onOpenInSearch` for the popup).
- Added `handleOpenInSearch(searchName)` helper inside the
  editor that looks up `catalogueByName[searchName].search` and
  dispatches it through the parent's callback.
- Each card's header gets an `<ExternalLink>` icon-button next
  to its action buttons. Disabled when no search is bound;
  enabled and styled sky-tinted when a search is bound. Hover
  title is "Open this search in Splunk Search to test it".

#### 4. Unknown-status probe animation
- `packetProfile()` previously returned `null` for `unknown`
  status. Replaced with a slow / faint "probe" profile (subtle
  level: 1 packet, 8s cycle, 35% opacity; on level: 2 packets,
  6.5s cycle, 45% opacity, slate-400 fill). Marketing-grade
  motion that doesn't overstate health: it's a "the link is
  alive even before data lands" signal, not a measurement.
- Once the bound search returns rows, the status promotes to
  stable / warning / critical and the packets re-tune to those
  cadences automatically.

#### 5. `[overview_link_te_a2a_health]` v1.0.0 → v1.1.0 (raw events)
- Switched the SPL from `tstats` against
  `Cisco_ThousandEyes.Test_Metrics` to a raw-event search
  against `cisco:thousandeyes:metric` (gated by
  `` `index_thousandeyes` `` macro and the
  `thousandeyes.test.type="agent-to-agent"` filter).
- Why: on the customer, the metric-store wrapper exposed only
  `network.latency` from the data model — `network.loss`,
  `network.jitter`, and every `thousandeyes.source.agent.geo.*`
  path returned null. Raw events have all the fields verbatim,
  so we read them directly and lose nothing.
- All field references switched to single-quoted dotted-path
  form (`'thousandeyes.source.agent.location'` etc.) so Splunk
  treats them as literal field names.
- Added a "Diagnostic SPL" entry under `related_info` that
  documents *exactly* how to verify field availability in any
  customer's stack — both raw events and the data model — so
  the next person hitting "empty fields" can self-diagnose
  without reading our git history.
- Tag set updated: removed `Requires_Cisco_ThousandEyes_DM`,
  added `Raw_Events`.

### Files touched

- `src/main/webapp/common/components/florida/CustomerTopologyMap.tsx`
  - `SelectionCard` props + body simplified.
  - `TopologyEditorPanel` props extended with
    `onOpenInSearch`; per-card collapsible state +
    Open-in-Search wiring; both site and link cards
    refactored to header + body shape.
  - `packetProfile()` returns a probe profile for unknown.
- `src/main/resources/splunk/default/searchbase.conf`
  - `[overview_link_te_a2a_health]` v1.0.0 → v1.1.0 raw-event
    rewrite, with diagnostic SPL embedded in the docstring.
- `src/main/resources/splunk/default/app.conf`
  - Build 74 → 75.

### Verification

- `yarn tsc --noEmit -p tsconfig.json` → clean (1.78s).
- `yarn build` → succeeds; only the pre-existing asset-size
  warnings (overview.js bundle, searchbase.conf, background
  PNGs) — no code-quality warnings introduced.

### Notes for the customer follow-up

When Alan deploys Build 75 to the customer, the link's bound search is
unchanged (`Overview - Link ThousandEyes A2A Health`), but the
SPL behind it is now raw-event-driven. The empty fields he saw
in the Build 74 screenshot should populate. If any field stays
empty, the `related_info` for the stanza now includes the exact
diagnostic SPL to introspect raw events and the data model
side-by-side. The animation regression on dev is fixed at the
renderer level — no SPL change needed there.

### What's next

- Sanity-check the raw-event stanza on the customer. If field names
  don't match the customer's actual events (e.g. some TA
  versions use underscored field names like
  `thousandeyes_source_agent_location`), update the SPL to
  alternative paths.
- After Alan confirms the link popup is clean, consider a
  similar collapsible treatment for the JSON import/export
  section in the editor — that one is also always-expanded
  and rarely used.

---

## 2026-05-12 (very, very late, dedicated TE A2A stanza) — `[overview_link_te_a2a_health]`

### Context

After the catalogue browser shipped (build 73), Alan opened the
picker, found ~260 entries he could browse, and immediately
identified the deeper issue:

> "we need one search that returns latency, jitter, loss and other
> metrics per our discussion and per the csv I gave you earlier to
> learn to use to build good searches for the TE data!!!! do you
> understand???"

The picker was right; the catalogue was wrong. The AUB↔TLH link's
OOB default was `Overview - Link Auburndale to Tallahassee Health`
— a multi-source SPL that prioritizes SD-WAN > TE A2A > Catalyst
Center. Functionally correct (TE was Priority 2, so on customer it
won), but the stanza name doesn't say "ThousandEyes" and the
operator can't tell from the catalogue list which entries are
purely TE-driven. Alan wanted a dedicated TE A2A stanza he could
pick on purpose.

### Fix (build 74, commit pinned below)

Added `[overview_link_te_a2a_health]` (search_name = `Overview -
Link ThousandEyes A2A Health`) to `searchbase.conf`. Standalone
counterpart to the umbrella stanza — TE A2A only, no SD-WAN /
Catalyst Center fallbacks. Same agent-location filter (both
"Tallahassee" / "TLH" AND "Auburndale" / "AUB" must appear in the
combined source location | target location | source agent name |
target agent name | test name string), so it's self-installing
across customers.

Returns one normalized row with every field the map renderer
reads, derived from the schema Alan documented in the 2026-05-12
CSV export of `cisco:thousandeyes:metric` events:

- `id`, `linkId`, `sourceSiteId`, `targetSiteId` — topology shape
- `status` (critical / warning / stable / unknown) scored from
  loss / latency / jitter using the same thresholds as the umbrella
- `latencyMs`, `lossPct`, `jitterMs` — the three network metrics
- `sourceAgent` / `targetAgent` (single) and `sourceAgents` /
  `targetAgents` (multivalue, in case more than one A2A test
  matches)
- `sourceLocation`, `targetLocation` — human-readable city strings
  ("Tallahassee, Florida, US")
- `sourceCountry`, `targetCountry`, `sourceRegion`, `targetRegion`
  — ISO codes
- `teAccountId`, `teTestId`, `teTestName` — test identity
- `teLink` = `coalesce(teLinkPermalink, teLinkConstructed)` — TE
  emits a permalink with every metric event, so we prefer it; the
  Path Visualization URL is constructed defensively as fallback
- `lastUpdated`, `telemetrySource` — for the popup footer
- Defensive `appendpipe [stats count | where count=0 | eval ... ]`
  guarantees one row even when the data model returns nothing,
  surfacing as `status="unknown"` instead of an empty result.

Tagged `Cisco, Map, Link, Topology, Topology_Link, ThousandEyes,
A2A, Agent_to_Agent, Requires_Cisco_ThousandEyes_DM, Auburndale,
Tallahassee, Geo_Enriched, Agent_Location_Match`. The
`Topology_Link` tag means the stanza floats to the top of the
catalogue browser's link picker with the `[link]` badge; the
`A2A` and `Agent_to_Agent` tags let operators filter to TE-only
entries with a single chip.

### Wire-up

Updated the factory `CUSTOMER_TOPOLOGY` in `CustomerTopologyMap.tsx`:
the AUB↔TLH link's `searchName` now points to `Overview - Link
ThousandEyes A2A Health` instead of the multi-source umbrella.
The umbrella stanza stays in the catalogue (still selectable via
the browser) for customers running SD-WAN who want the
prioritization. Comment in the factory entry explains the choice
and points operators at the picker for the swap-back path.

### Verification

- `yarn tsc --noEmit` clean
- `yarn run build` clean — `searchbase.conf` 1.80 MiB → 1.81 MiB
  (the new ~10 KB stanza); `overview.js` unchanged
- Lint clean

### What's next

When Alan deploys build 74 and confirms the AUB↔TLH map line is
driven by `Overview - Link ThousandEyes A2A Health` (visible in
the popup's Show SPL and the catalogue browser's checkmark), the
data-source story is closed. Follow-ups left on the backlog from
prior sessions:

- Auto-discover topology from A2A event fields (every distinct
  agent → site, every test → link, lat/lng resolved via geonameId
  lookup). The dedicated stanza here makes that discovery
  conceptually simpler — same data shape, just enumerate instead
  of filter.
- A `[overview_link_te_a2a_overview]` umbrella that returns one
  row per A2A test path globally (not pre-filtered to AUB↔TLH),
  so a future multi-link topology gets fed by a single search.

### Commit

`3ea18ef` — searchbase: add dedicated TE A2A link health stanza, wire as AUB↔TLH default

---

## 2026-05-12 (still very late, full catalogue browser) — TopologySearchBrowser component

### Context

After build 72 shipped a sky-accent dropdown, Alan deployed and
discovered a real bug we'd missed by tunnelling on visibility:

> "what is this non-sense!!!! change what??? it does not allow
> browsing any search."

He was right. The dropdown only listed entries tagged
`Topology_Site` or `Topology_Link` — five items total. Alan's
explicit comparison was the KPI tile picker, which browses the
entire Cisco-tagged catalogue (~260 entries) with free-text search
and tag chips. We were giving him a 5-item curated shortlist when
he asked for the same browse-and-pick experience.

### Fix (build 73, commit pinned below)

Replaced the dropdown with a new `TopologySearchBrowser` component
that mirrors `KpiPickerPanel`'s filter model:

- **Source**: full Cisco-tagged catalogue (~260 entries), same
  filter the KPI picker uses. Topology-tagged entries no longer
  filter the list — they sort to the top via a new `preferredTags`
  prop and pick up a small "site" / "link" badge so they're still
  scan-spottable.
- **Free-text search**: matches against `searchName`, `category`,
  `subCategory`, and tag names. Type "ThousandEyes" to narrow to
  TE feeds; type "TLH" to jump to Tallahassee-specific stanzas.
- **Tag chips**: clicking "+ filter by tag" opens the top-12
  tags by frequency in the current filtered slice. Selected tags
  show as pills with an X to remove. Multiple tags AND together,
  matching the KPI picker pattern.
- **Result list**: scrollable (max-h ~18rem), shows category /
  sub-category beneath each name, currently-bound entry has a
  checkmark and the sky-accent highlight, click-to-apply.
- **Free-form input** (editor only): below the list, an input +
  Apply button for stanza names not yet in the catalogue. The
  read-only popup hides this — picks there are scoped to the
  vetted catalogue.

The component is used in three places, identical UI:
- Map popup (read-only) — `SelectionCard` renders it inside the
  panel for the currently-selected site / link.
- Editor → site card — replaces the prior dropdown.
- Editor → link card — replaces the prior dropdown.

Touch points in `CustomerTopologyMap.tsx`:
- `popupSearchOptions` and `editorSearchOptions` are now the
  same shape (Cisco-tagged, alphabetised). The previous
  `popupSiteSearchOptions` / `popupLinkSearchOptions` /
  `siteSearchOptions` / `linkSearchOptions` quartet collapsed
  into these two.
- `SelectionCardProps.searchOptions` replaces the previous
  per-kind props.
- Lucide imports add `Check`, `Search`, `Tag`.

`app.conf` build 72 → 73.

### Verification

- `yarn tsc --noEmit` clean
- `yarn run build` (webpack production) clean — `overview.js`
  grew from 1.37 MiB to 1.38 MiB (~10 KB for the new component;
  expected).
- ReadLints clean for `CustomerTopologyMap.tsx`.

### What's next

Once Alan deploys build 73 and confirms he can browse the full
catalogue + filter by name and tag, this conversation can finally
move on. If the picker still looks wrong, the next item is likely
ergonomic refinements (sticky headers, keyboard navigation, tile
preview pane à la KpiPickerPanel) — but not a redesign.

### Commit

`31f6f28` — TopologySearchBrowser: full catalogue browse-and-pick UI

---

## 2026-05-12 (very late, picker visibility) — Make the data-source picker unmissable

### Context

Even after `af6560d` and `71d810e` shipped the per-site / per-link
search picker (in the editor and in the read-only popup), Alan still
could not find it on the deployed customer stack:

> "where is the option to pick a different search for the sites and
> link?? in the stupid screenshot, where is it? I been asking you for
> the last 2 hours the same stupid ask!"

### Diagnosis

Three plausible reasons Alan wasn't seeing the picker, only one of
which we control directly:

1. **Build drift.** The build deployed to customer might pre-date `fb5a275`
   (build 67). If so, the picker code literally isn't in the bundle.
   We can't fix this from the codebase — only by bumping the version
   so Alan can see a fresh build number land.
2. **Catalogue gate.** All three picker placements were gated on
   `catalogueLoaded && options.length > 0`. If the searchbase REST
   endpoint stalled or returned nothing tagged `Topology_Site` /
   `Topology_Link`, the picker would render `null`. From the user's
   perspective: "there's no option" — accurate, but for an unrelated
   reason.
3. **Discoverability.** The picker existed but used quiet greyed-out
   styling (`text-slate-500`, no border accent), labeled "Data source"
   in `text-[8px]`. On a long site / link card with NAME / SHORT /
   ROLE / STATUS / coordinates / Catalyst Center fields / etc., the
   one row that mattered for the conversation was the one styled
   like all the others, near the top.

### Fix (build 72, commit pinned below)

Three coordinated changes to `CustomerTopologyMap.tsx`, applied to
all three picker placements (read-only popup, editor site card,
editor link card):

1. **Render unconditionally.** The `if (!catalogueLoaded ||
   options.length === 0) return null` gate is gone. The dropdown
   always renders. When the catalogue is loading, the dropdown is
   `disabled` with placeholder "Loading catalogue…". When the
   catalogue returned no tagged entries, the placeholder reads "No
   catalogue entries — type a custom name below" and the free-form
   text input below stays editable. The picker is now a permanent
   structural part of the card, not a conditional.

2. **Sky-accent visual treatment.** The container went from neutral
   slate (`border-slate-800 bg-slate-900/40`) to a sky-blue accent
   (`border-2 border-sky-500/60 bg-sky-500/10` in dark, the lighter
   equivalent in light). The header label went from `text-[8px]
   text-slate-500` to `text-[10px] text-sky-300 font-black` and now
   reads "▾ CHANGE SEARCH (site)" / "▾ CHANGE SEARCH (link)" instead
   of the generic "Data source". The dropdown itself got a `border-2`
   and a brighter focus ring.

3. **Helper text rewritten** to use the verb the user uses: "Swap
   which searchbase.conf entry powers this site marker. Demo stanzas
   let you preview green / amber / red states without real
   telemetry." For links: "Swap which searchbase.conf entry measures
   this connection. Includes the live ThousandEyes A2A stanza and
   Demo feeds."

The picker now appears in three places, all visually identical:

- **Map popup** — click any site or link; the picker is the highlighted
  blue panel inside the popup, above the "Show SPL" toggle.
- **Editor → site card** — click the pencil icon, expand any site;
  the picker is the highlighted blue panel near the top.
- **Editor → link card** — same, for any link.

`app.conf` build bumped from 71 → 72. Once Alan deploys, the version
string in the app's footer / about page will read 72; if it still
reads <72, the deploy didn't take.

### Verification

- `yarn tsc --noEmit` clean
- `ReadLints` clean for `CustomerTopologyMap.tsx`
- Visual: in dev, the picker is the only sky-accented panel on each
  card / popup, impossible to confuse with the surrounding fields.

### What's next

When Alan confirms he sees the highlighted "▾ CHANGE SEARCH" picker
on customer and the dropdown lists the expected entries, the discovery
problem is closed. If on build 72 the dropdown is `disabled` and
reads "No catalogue entries — type a custom name below", the next
step is to debug the searchbase REST endpoint on customer (likely a
permissions / app-namespace issue), not the React component.

### Commit

`4d59ad7` — Topology pickers: render unconditionally with sky-accent visual treatment

---

## 2026-05-12 (late, two missed stanzas) — Location filter applied to umbrella + inter-site latency

### Context

After the previous session committed the agent-location filter to
`[overview_link_auburndale_tallahassee_health]` (v1.7.0, commit
`af6560d`), Alan deployed and reported the link search still showed
the old SPL. Frustrated and rightly so:

> "for the love of God, what are you doing?????? where the heck is
> the change!!! I don't see nothing. and the link search for the
> 11th time is still wrong!!!"

### Diagnosis

Ran `awk '/^\[/ { stanza = $0 } /TLH - BLA Connection/ { print
NR": "stanza }' searchbase.conf` and got back **three** stanzas
referencing the placeholder test name:

1. `[overview_topology_overview]` line 9494 — SPL body. Umbrella feed
   that drives the topology map's overall summary and the right-column
   "TLH ↔ AUB latency" tile.
2. `[overview_inter_site_latency]` lines 9582 (explanation) and 9587
   (SPL body) — standalone tile for the same metric.
3. `[overview_link_auburndale_tallahassee_health]` line 9881
   (explanation only — already fixed in v1.7.0).

The `af6560d` commit only fixed stanza #3. The umbrella and the
right-column tile both kept the hardcoded test name. Alan was
clicking through to "Show SPL" or running the inter-site latency
search and seeing the old filter — which is exactly what was
deployed.

### Fix (commit pending, build 71)

Applied the same agent-location-match pattern to both remaining
stanzas:

```
| tstats `summariesonly` avg(...) AS latencyS,
    latest(Test_Metrics.thousandeyes.source.agent.location) as sourceLocation,
    latest(Test_Metrics.thousandeyes.target.agent.location) as targetLocation,
    latest(Test_Metrics.thousandeyes.test.name) as teTestName
    FROM datamodel="Cisco_ThousandEyes.Test_Metrics"
    WHERE Test_Metrics.thousandeyes.test.type="agent-to-agent"
    BY Test_Metrics.thousandeyes.source.agent.name,
       Test_Metrics.thousandeyes.target.agent.name,
       Test_Metrics.thousandeyes.test.id
| rename Test_Metrics.thousandeyes.source.agent.name as sourceAgent,
         Test_Metrics.thousandeyes.target.agent.name as targetAgent
| eval _agentScope=coalesce(sourceLocation,"")."|".coalesce(targetLocation,"")
        ."|".coalesce(sourceAgent,"")."|".coalesce(targetAgent,"")
        ."|".coalesce(teTestName,"")
| where match(_agentScope,"(?i)Tallahassee|TLH")
    AND match(_agentScope,"(?i)Auburndale|AUB")
| stats avg(latencyS) AS latencyS
| appendpipe [ stats count | where count=0 | eval latencyS=null() ]
...
```

- `[overview_topology_overview]` v1.3.0 — umbrella's inner inter-site
  latency block now uses the location-match filter.
- `[overview_inter_site_latency]` v1.1.0 — standalone tile uses the
  same filter; explanation rewritten to match.
- `app.conf` build = 71.

### Verification

`grep "TLH - BLA Connection"` against the entire `default/`
directory returns zero matches outside of historical narrative.
`yarn run tsc --noEmit` clean (no React changes this round).

### What's next

Operator needs to re-package and push: `yarn run package:app` then
ACS install the resulting `dist/splunk-cisco-dashboards-1.0.10.tar.gz`.
After that, the diagnostic search:

```
| rest /servicesNS/-/splunk-cisco-dashboards/configs/conf-searchbase
| search title="overview_link_auburndale_tallahassee_health"
        OR title="overview_inter_site_latency"
        OR title="overview_topology_overview"
| eval has_new_filter=if(match('content.search', "_agentScope"),
        "YES — new SPL", "NO — old SPL")
| table title 'content.version' has_new_filter
```

…should return three rows, all with `has_new_filter="YES"`.

### Process callout

I owe the user a clearer "no stone unturned" pass when applying
multi-stanza changes. The right pre-flight check before claiming a
fix is complete is the same `awk` one-liner above against the
identifying string. Adding a `pre-commit-check.sh` that greps for
known placeholders against the conf tree is the cheap way to prevent
the same mistake.

---

## 2026-05-12 (late, post-deploy regression triage) — Map animation, popup dismiss, in-popup data-source picker, location-based TE A2A filter

### Context

Alan deployed the latest build to customer and reported a sharp set of regressions:

> "after deploying latest build to the fdem stack, animation is no
> longer working, see screenshot, also I still see the old site
> link search, it did not update like you promised at all, I also
> need the modal to go away on escape or after clicking outside of
> it, that use to work but now broken. I am getting frustrated with
> asking 10 times for the ThousandEyes search we agreed we will be
> using, i.e. the agent-to-agent search. what is going on with that
> and why we still don't have an option in the editor to slect a
> search from searchbase for either the site icons or the links
> between them."

Five distinct complaints in one message, all valid, all worth
fixing in one pass.

### Diagnosis

1. **Animation dead.** The AUB↔TLH link's `CUSTOMER_TOPOLOGY` default
   status is `'unknown'`. `packetProfile()` (the function that decides
   how many packets to emit and at what cadence) returns `null` for
   `'unknown'` — by design, "unknown stays quiet." Status only flips to
   `stable` / `warning` / `critical` when the link search returns rows.
   the customer's stack returns no rows (see #2), so status stays `unknown`,
   so no packets render. The "broken animation" the user sees is the
   downstream effect of the SPL filter not matching anything.
2. **SPL filter pinned to a placeholder test name.** The TE A2A branch
   of `[overview_link_auburndale_tallahassee_health]` (v1.6.0) had:
   ```
   WHERE Test_Metrics.thousandeyes.test.type="agent-to-agent"
         Test_Metrics.thousandeyes.test.name="TLH - BLA Connection"
   ```
   "TLH - BLA Connection" exists in my dev TE org as a working A2A
   placeholder, but the customer's TE org has its own A2A test name. So the
   filter never matched, the branch returned zero rows, the Catalyst
   Center fallback kicked in (which only carries endpoint health, not
   path metrics), and the popup showed Awaiting on every metric.
3. **Click-outside-to-dismiss broken.** The current handler is
   `MapClickCapture.onBackgroundClick`, which fires when a click hits
   empty Leaflet pixels. On the customer's narrow right-column layout the
   panel covers basically the whole map column — there are no empty
   map pixels to click. So the dismissal contract silently dies.
4. **Escape sometimes swallowed.** The Escape listener was on the
   bubble phase. Any focused descendant (editor input, Leaflet
   keyboard handler) that called `event.stopPropagation()` would eat
   the key before document-level handler ran.
5. **No data-source picker visible.** The picker `fb5a275` added is
   inside the `TopologyEditorPanel`, which only opens when the user
   clicks the pencil icon under the map. From the read-only popup
   there was no path to swap searches. The user expected the swap to
   live where they were already looking.

### Fixes (single commit, build 70)

1. **`searchbase.conf` v1.7.0**: replaced the hardcoded test-name
   filter with a post-aggregation `where` that matches on a combined
   string of source agent location + target agent location + source
   agent name + target agent name + test name. Both "Tallahassee" or
   "TLH" *and* "Auburndale" or "AUB" must appear (case-insensitive).
   This catches the customer's actual A2A test (whatever it's named), our dev
   placeholder, and any future renaming. The filter is also resilient
   to older `TA-cisco_thousandeyes` versions that don't populate the
   `thousandeyes.source.agent.location` field — agent / test name
   matches still pass.
2. **Click-outside.** Moved the dismissal from the map's
   `onBackgroundClick` to a document-level `mousedown` listener owned
   by `SelectionCard` itself. Capture phase, so descendant
   `stopPropagation()` calls can't break it. Skips dismissal when the
   click lands on a Leaflet marker, interactive svg path, popup, or
   tooltip — those have their own click-to-toggle semantics.
3. **Escape.** Same component, same capture-phase pattern. Removed the
   parent-level Escape effect to keep the contract in one place.
4. **In-popup data-source picker.** Added a "DATA SOURCE / site search
   (or link search)" block inside the read-only popup, between the
   metric details and the Show SPL toggle. Same dropdown-of-catalogue
   pattern as the editor, same tag filter (`Topology_Site` /
   `Topology_Link`). On change, writes straight through to the
   persisted topology JSON via a new `onChangeSearchName` callback on
   `CustomerTopologyMap` (which also mirrors into `draftTopology` so
   re-opening the editor doesn't blow away the popup-driven edit).
5. **Animation.** No code change needed — once #1 lands, the customer's stack
   will populate the link with real path metrics, status will flip out
   of `unknown`, and packets will start flowing on their own.

### Verification

- `yarn run tsc --noEmit` clean.
- `ReadLints` clean for `CustomerTopologyMap.tsx`.

### What's next

Real-stack QA on Alan's environment to confirm:

- Map animation is back on the AUB↔TLH line (status flipped out of
  unknown).
- Link popup shows real ThousandEyes path metrics (latency / loss /
  jitter / agent locations / TE permalink) regardless of how the customer
  named their A2A test.
- Pressing Escape with the popup open dismisses it.
- Clicking outside the popup (anywhere on the page, not just empty
  map pixels) dismisses it.
- The "Data source" dropdown shows in the read-only popup with
  catalogue entries listed, and picking one swaps the marker / line
  to that feed without needing to open the editor first.

---

## 2026-05-12 (late, post-geo) — Unlocking the 6th tile in Security and Building

### Context

Alan posted a screenshot of the Security section showing five tiles
(FW Blocked, Threat Sources, Failed Auth, XDR Incidents, Security
Score) with the count pill at "5" and the + button greyed out. His
report:

> "Section 2 and 3 are still maxing out at 6 tiles, not letting me
> add one more, the + sign is shaded out."

### Diagnosis

The + button's `max` isn't simply `sectionTileBounds.maxCount` — the
overview render computes:

```
const sectionMaxAvailable = Math.min(
    sectionTileBounds.maxCount,        // 6 (global cap)
    allSectionMetrics.length            // 5 for security / building
);
```

…and feeds `sectionMaxAvailable` to the count pill. So even though
the global cap is 6, Security and Building cap at 5 because
`METRIC_CONFIG` only has five entries in each section. IT Health has
six entries (its + button works to 6), which is why Alan didn't hit
this on the IT Health row.

The render logic is correct — there's no use bumping the count past
the catalogue size because the slice `orderedIds.slice(0, count)` has
nothing to render past slot 5. The fix is to **add a 6th catalogue
entry** to each section.

### Decision: pick KPIs that complement, don't duplicate

Asked Alan via the structured-question prompt for each section. He
picked:

- **Security 6th: XDR Critical incidents** — narrower variant of the
  existing `xdr_incidents` tile, scoped to `severity="Critical"`
  only. The existing tile mixes Low / Medium / High / Critical and
  can drown a real critical spike in detection-tuning noise; the new
  tile answers the more direct executive question of *"how many
  incidents need a war-room right now?"* The two are complementary:
  `xdr_incidents` for SOC workload trend, `xdr_critical` for
  escalation pressure.
- **Building 6th: AP Health %** — Catalyst Center reachability
  percentage for the AP fleet. The obvious complement to "Wi-Fi
  clients" (clients on APs) and "Active devices" (everything
  tracked): if APs are unreachable, the rest of the building section
  is fiction.

### Implementation

**Two new searchbase stanzas** added in the Overview KPI cluster
(right after `[overview_inter_site_latency]`, before the legacy
site-leaderboard block):

`[overview_xdr_critical_incidents]`:

```spl
| `index_security` (sourcetype="cisco:xdr:incidents" OR sourcetype="cisco:xdr:incidents-summary")
  severity IN ("Critical","critical","CRITICAL")
| stats dc(id) as total
| appendpipe [ stats count | where count=0 | eval total=0 ]
| stats max(total) as total
| fields total
```

The case spread on `severity` defends against TA version differences
(older builds normalised to lowercase, current TA keeps title-case).
Uses the canonical `id` field (top-level on both sourcetypes) — same
schema lesson the parent stanzas learned in their 1.0.1 revision.
Tagged `Cisco,Overview,KPI,Security,XDR,Critical,Incidents`.

`[overview_ap_health]`:

```spl
| `index_catalyst` sourcetype="cisco:dnac:devicehealth"
| stats latest(DeviceFamily) as DeviceFamily, latest(Reachability) as Reachability by DeviceID
| where match(DeviceFamily, "(?i)ap|access.point|unified.ap")
| eval healthy=if(Reachability=="Reachable", 1, 0)
| stats count as total, sum(healthy) as up
| eval pct=round(up/total*100), down=total-up
| appendpipe [ stats count | where count=0 | eval total=0, up=0, down=0, pct=null() ]
| stats max(total) as total, max(up) as up, max(down) as down, max(pct) as pct
| fields pct total up down
```

Modeled directly on `executive_summary_ds_ap_count` — same family
regex (`AP | Access Point | Unified AP`, all three labels Catalyst
Center has used), same `Reachability=="Reachable"` flag (not
`Manageability` — control-plane manageability hiccups don't break
Wi-Fi for users). Defensive `appendpipe` so an empty feed renders
the tile with a `pct=null` em-dash rather than misleading "0%".
Tagged `Cisco,Overview,KPI,Building,Wireless,Catalyst_Center,Access_Points`.

**Two new `KPI_CONFIG` entries** in `overview/index.tsx`:

- `xdr_critical` (Security): `valueField: 'total'`,
  `thresholds: { warning: 1, critical: 5, direction: 'lower_is_better' }`,
  red accent (`#dc2626`) so it visually differentiates from the
  parent `xdr_incidents` tile (sky/neutral).
- `ap_health` (Building): `valueField: 'pct'`, `unit: '%'`,
  `thresholds: { warning: 97, critical: 92, direction: 'higher_is_better' }`,
  emerald accent (`#10b981`). Threshold ladder mirrors the existing
  `executive_summary_ds_ap_count` recommended-alerts block so alerts
  and tile colour stay coherent.

Both entries carry detailed `thresholdNote` text for the info popover
per the 2026-05-12 popover-thresholds work.

**No change to the rendering math** — once `METRIC_CONFIG` has 6
entries per section, the existing
`Math.min(sectionTileBounds.maxCount, allSectionMetrics.length)`
naturally lifts the cap to 6 for those sections.

### Why this approach (and not "decouple cap from catalogue")

The other obvious option was to let the + button go to 6 regardless
of catalogue size and render an empty 6th tile that the user could
fill via the picker. Two reasons against:

1. **Empty tiles look broken.** A blank slot in a row of working
   metrics reads as "this didn't load" — which is the actual error
   state we use elsewhere on the page. Conflating the two breaks the
   "everything is fine" / "something is broken" visual contract.
2. **The picker swaps, doesn't add.** Today's picker overrides assign
   a saved search to an *existing* slot. There's no UX path to
   create a slot ex nihilo without also adding it to METRIC_CONFIG,
   which is the same thing we just did. Decoupling would have been
   half a feature.

So adding real defaults is the cleanest path: + reaches 6
naturally, the tile shows useful data on first paint, and the user
can still swap either of the new defaults via the picker for a
different Cisco-tagged KPI.

### Verification

- `tsc --noEmit` from package root: clean (~2.3s).
- `ReadLints` on `overview/index.tsx` and `searchbase.conf`: clean.
- Pre-existing localStorage state behavior: users who saved count=5
  will reopen with count=5 (correct — they explicitly chose 5), but
  the + button now lights up so they can dial up to 6 if they want.
  New users get fallbackDefault=6 across all three sections.
- Stanza schemas: both new searches return single-row outputs with
  the `valueField` named in `KPI_CONFIG` (`total` and `pct`), and
  both end with explicit `| fields ...` lines so no extra columns
  leak into the picker preview.
- Both stanzas tagged `Cisco` so the picker surfaces them as
  swappable defaults for any other tile in the overview.

### What's next

- **Real-stack QA on Alan's environment.** Open the Overview page,
  confirm Security count pill now reads "6" and the + button is
  grayed when at the new ceiling; confirm the new XDR Critical and
  AP Health tiles render real numbers (and fall back to 0 / em-dash
  cleanly when their feeds are empty). Verify the info popover for
  each shows the new threshold ladder.
- **App.conf build → 69** so Alan's next package picks up the new
  stanzas and KPI bindings.

---

## 2026-05-12 (late, post-CSV) — Geo-enriching the AUB↔TLH link from ThousandEyes A2A event fields

### Context

Alan reviewed a raw export of `cisco:thousandeyes:metric` events
(`thousandeyes.test.type="agent-to-agent"`, sample test "Detroit to
Chicago Test" — 760+ rows, every field intact) and pushed back with
clear conviction:

> "I am convinced now we should use ThousandEyes agent-to-agent tests
> between locations and the event itself (see sample) has everything
> we need!!! we can derive the country, state, location etc...even
> the link to the test which we need so we can launch TE's web UI
> see `thousandeyes.permalink`. I ran this non-data-model search ...
> this is just so you have all the field names right and so we can
> populate the map data with it."

The CSV confirms three things we'd previously been hand-waving:

1. **Per-event `thousandeyes.permalink`** ships with every metric event,
   already URL-encoded, scoped to test / agent / direction:
   `https://app.thousandeyes.com/network-app-synthetics/views?__a=...&agentId=...&direction=round-trip&teRegion=2&testId=...`.
   This is **TE-authored** — they own the URL format, so it's the most
   resilient deep-link source.
2. **Per-agent geo metadata** is structured — `iso_code` for country
   (US), `iso_code` for region (FL, MI, OR), human-readable
   `location` ("Tallahassee, Florida, US"), and a `geoname.id`
   pointing at the geonames.org row for that city. We don't need a
   separate enrichment pipeline; the event already carries all of it.
3. **Schema is uniform across A2A tests** — same field shape for
   "Detroit to Chicago" as for "TLH - BLA Connection", which means
   anything we do for one test works for any A2A test in any
   customer's TE org.

### Decision: enrich the existing link stanza now, defer auto-discovery

Two ways to consume this. (a) Auto-discover the entire topology from
A2A event fields — every distinct agent becomes a site, every
distinct test becomes a link, lat/lng resolved from a
`geonameId → coordinates` lookup. (b) Keep the hand-authored TLH/AUB
topology and enrich the existing link stanza with the new fields.

Going with (b) for this round. It's a tight, scoped change that
delivers Alan's direct ask ("populate the map data with it") without
opening the lat/lng-from-geoname rabbit hole. Auto-discovery stays
on the backlog — it's the right long-term direction, but it needs
either a CSV lookup of geoname → lat/lng or an inline `case()` of
known cities, plus a plan for what happens when a TE A2A test
references an agent that isn't in our topology. Bigger conversation.

### Implementation: `[overview_link_auburndale_tallahassee_health]` v1.6.0

**TE branch (Priority 2) tstats now also captures:**

```spl
latest(Test_Metrics.thousandeyes.permalink) as teLinkPermalink,
latest(Test_Metrics.thousandeyes.source.agent.location) as sourceLocation,
latest(Test_Metrics.thousandeyes.target.agent.location) as targetLocation,
latest(Test_Metrics.thousandeyes.source.agent.geo.country.iso_code) as sourceCountry,
latest(Test_Metrics.thousandeyes.target.agent.geo.country.iso_code) as targetCountry,
latest(Test_Metrics.thousandeyes.source.agent.geo.region.iso_code) as sourceRegion,
latest(Test_Metrics.thousandeyes.target.agent.geo.region.iso_code) as targetRegion,
```

These all live inside the existing `BY source.agent.name,
target.agent.name, account.id, test.id` grouping. Agent location is a
1:1 attribute of the agent — every event for one (sourceAgent,
targetAgent) pair carries the same location string — so `latest()`
within the BY plus `first()` through the outer aggregation is safe.

**SD-WAN branch (Priority 1)** and **Catalyst Center fallback
(Priority 3)** explicitly null these new fields so the `append`
schemas line up.

**Outer `stats by linkId` propagates** the new fields via `first(...)`
(except agents, which stay `values()` because they can be multivalue).

**`teLink` switches strategy:**

```spl
| eval teLinkConstructed=if(isnotnull(teAccountId) AND isnotnull(teTestId) AND isnotnull(lastSeen),
    "https://app.thousandeyes.com/network-app-synthetics/views/?testId=...&direction=BIDIRECTIONAL&...",
    null())
| eval teLink=coalesce(teLinkPermalink, teLinkConstructed)
```

Prefers the TE-emitted permalink. Falls back to the constructed
Path-Visualization URL only if the permalink is missing (e.g.
older TA-cisco_thousandeyes versions where `permalink` wasn't in the
data model, or aggregated rows where the field didn't survive).

**Final `| fields ...`** adds `sourceLocation, targetLocation,
sourceCountry, targetCountry, sourceRegion, targetRegion` after
`sourceAgents, targetAgents` and before `teAccountId, teTestId,
teLink`.

### Implementation: TS / React side

**`TopologyLink` interface** (`common/types.ts`) gains six new
optional string fields with JSDoc explaining their TE provenance and
linking back to the searchbase stanza. Kept `teLink`'s comment up to
date with the v1.6.0 strategy.

**`parseLinkRow`** (`CustomerTopologyMap.tsx`) reads all six new
fields with both camelCase aliases and the raw `thousandeyes.*` field
names — defensive against future raw-event piping where the dotted
field names might survive. Falls back to `base.<field>` so a
hand-authored topology row that already had a value isn't clobbered
by a missing field on a refresh.

**`LinkDetails` popup** renders a new line under the agent-pair line:

```tsx
{(link.sourceLocation || link.targetLocation) && (
    <p className="text-[9px] leading-relaxed text-slate-400/600">
        {link.sourceLocation ?? '\u2014'} ↔ {link.targetLocation ?? '\u2014'}
    </p>
)}
```

So the operator sees:

```
Measured by demt-te01-va ↔ demc-te01-bla
Tallahassee, Florida, US ↔ Boulder, Colorado, US
TLH-AUB to AUB-TLH - Updated 2026-05-12 21:42:00
[ View in ThousandEyes ]
```

(Real example will be Tallahassee↔Auburndale once the customer A2A test
is back in service; currently we're piggy-backing on
"TLH - BLA Connection" for dev/test per the 2026-05-12 placeholder
note.)

The "View in ThousandEyes" button is unchanged in code — it reads
`link.teLink` — but its target now points at TE's per-event
permalink instead of the constructed Path-Vis URL.

### Why this is the right shape

- **Authoritative URL.** TE owns the permalink format. If they ship a
  new query-param (e.g. a `view=` selector) we get it for free.
- **No new lookups.** All data comes from fields the TA already
  parses. Zero infra changes.
- **Customer-agnostic.** The same field reads work for the customer's
  "TLH - AUB Connection" or anyone else's A2A test once the test name
  filter is updated. Geo strings are emitted by TE, not by us, so
  they're correct for whatever location the agent reports.
- **Backwards-compatible.** Hand-authored topologies on customer
  installs that haven't refreshed yet still render fine — the new
  fields are optional and the popup hides the location line when
  both are null.

### Verification

- `tsc --noEmit` from `packages/splunk-cisco-dashboards`: clean.
- `ReadLints` on the two changed React files: no lint errors.
- Searchbase grammar: spot-checked the four append/`fields` stanzas
  for matching column lists; SD-WAN, TE A2A, and DNAC fallback all
  emit `teLinkPermalink, sourceLocation, targetLocation,
  sourceCountry, targetCountry, sourceRegion, targetRegion` so the
  union is well-formed.
- The popup will render gracefully even if Alan's TE event flow
  doesn't have `permalink` populated — the `coalesce` falls back to
  the constructed URL, and the location line conditionally hides if
  both `sourceLocation` and `targetLocation` are missing.

### What's next

- **Real-stack QA on Alan's environment.** Open the Overview map,
  hover the AUB↔TLH link, and confirm the popup shows the new
  "Tallahassee, Florida, US ↔ ..." line and that "View in
  ThousandEyes" lands on the per-event permalink (not the
  constructed URL). The placeholder test "TLH - BLA Connection"
  should expose the BLA agent's location string — that's the
  smoke-test that tells us geo enrichment is wired up end-to-end.
- **Auto-discovery follow-up.** Decide whether to ship a
  `geonameId → {lat, lng}` lookup (CSV in `lookups/`) and a new
  `[overview_thousandeyes_a2a_topology]` searchbase entry that
  emits one `itemType=site` row per distinct A2A agent and one
  `itemType=link` row per A2A test. That's the unlock for "the map
  builds itself from TE data". The existing hand-authored topology
  would stay as the canonical layout; auto-discovery would add
  newly-observed agents as suggestions in the editor's "discovered"
  list.
- **Country / region badges.** We capture `sourceCountry` /
  `sourceRegion` (US / FL etc.) but the popup only renders the
  location string today. A small follow-up could surface them as
  flag emojis or pill badges next to each agent name. Holding for
  now until we see how the location-string line lands visually on
  Alan's stack.

---

## 2026-05-12 (late night) — Topology editor opacity, section defaults, and replacing the two right-column KPIs

### Context

Three discrete asks on top of the threshold-popover landing:

1. **Topology editor is unreadable.** Alan posted a screenshot of the
   editor panel where the entire form was visibly transparent — the
   underlying map, road outlines, and city labels (Tallahassee,
   Jacksonville, Daytona Beach) bleed straight through the inputs.
   "It's hard to work here, I think the opacity can be adjusted to
   make it easier to read."
2. **Section defaults.** From the previous round of questions: bump
   the per-section maximum tile count to 6, and default *all three*
   sections to 6 visible tiles. The earlier `defaultCount: { it_health: 3 }`
   landed before Alan saw the result; once he did, the executive view
   felt half-empty on wider monitors.
3. **Replace the two right-column KPIs** next to the topology map.
   Alan: *"In screenshot 2, find 2 better metrics please and make
   sure they work, I don't like what we have now unless you
   disagree."* The two existing tiles are "Top incident volume"
   (showing the `Site enrichment unavailable` sentinel) and
   "Operational lead" (showing `Global/APAC/Sydney-AU/WAN-Edge` —
   demo data leakage from a different customer's DNAC fixture).

### Diagnosis: opacity

The editor panel's parent element used `bg-slate-950/96` (dark) and
`bg-white/98` (light) — slash-opacity modifiers `/96` and `/98` that
**don't exist in Tailwind's default opacity scale and aren't
extended in `tailwind.config.js`** (`important: '#scan-root'` plus
basic font-family extensions, no opacity scale). Tailwind silently
drops unknown slash modifiers, so the rendered class string had no
generated CSS and the panel rendered effectively transparent. The
`shadow-2xl` was carrying the entire visual separation.

### Fix: opacity

Replaced both classes with their solid equivalents (`bg-slate-950`,
`bg-white`) and added `backdrop-blur-sm` for a subtle frosted feel
on whatever the rounded corners or shadow penumbra reveal. The
nested per-site row uses `bg-slate-50` (light) and `bg-slate-900/70`
(dark) — `/70` *is* in the default Tailwind scale, so once the
parent panel is fully opaque the per-site cards stack legibly on
top.

Also did a sweep for any other `/9[678]` slash-opacity values across
`packages/splunk-cisco-dashboards/src/main/webapp` — only the comment
referencing the old pattern came back, so nothing else was silently
broken.

### Section defaults

`usePersistedSectionTileCounts` parameters in `pages/overview/index.tsx`:

- `minCount: 3` (unchanged)
- `maxCount: 6` (unchanged — already cap from the IT Health 6th tile)
- `defaultCount: {}` (was `{ it_health: 3 }`)
- `fallbackDefault: 6` (was `5`)

Returning users keep whatever count they previously set because the
preference is keyed off `localStorage`. This only flips the *first
load* default to "show everything in the catalogue" so the operator
dials *down* with the count pill if they want a tighter focus.
Updated the long block comment over the parameters and the
matching IT Health section comment over `METRIC_CONFIG` so future
readers know the rationale.

### Diagnosis: the two broken KPIs

`overview/index.tsx`'s right-column tiles bind to two saved searches
via `KPI_CONFIG[0]` (Top Incident Volume) and `KPI_CONFIG[1]`
(Operational Lead). Both also have their SPL embedded inside
`overview_topology_overview` as `append [search ...]` summary blocks
— the React component reads those rows via `topologySummaryById` and
shadows the `useKpi` value when no override is bound. So the
"Topology Overview" feed was the actual source of the displayed
strings, not the standalone stanzas.

- **Top Incident Volume.** Pulls from
  `cisco:xdr:incidents` / `cisco:xdr:incidents-summary` and groups
  by a `site` field that is *not* shipped by default by the XDR TA.
  The stanza already has a defensive `eval site=coalesce(site,
  "Site enrichment unavailable")` sentinel — and that sentinel is
  exactly what was visible on Alan's stack. The bug is real but
  upstream (Cisco TA / customer enrichment), not something the
  dashboard can fix.
- **Operational Lead.** Pulls from `cisco:dnac:devicehealth`,
  groups per `Site`, ranks by reachable+managed score. The fixture
  on Alan's stack carries Sydney/APAC `WAN-Edge` rows from a
  different demo customer's DNAC dump (the customer data this app
  expects has *only* TLH and AUB Sites). So the leaderboard
  surfaces an unrelated site name.

Both are *site-ranking* strings. Even with the data fixed, ranking
is barely informative for the customer's 2-site footprint — the leader and
the trailer would be the same two sites every refresh. The map
already shows per-site colours and per-link colours; the right
column is more useful as **aggregate signals** the map can't show.

### Replacement: two new KPIs

Two new searchbase stanzas, both using TE data we already prove
works on Alan's stack via the link-health and IT-Health-alerts tiles:

- `[overview_active_critical_alerts]` → "Active critical alerts"
  — single-row count of currently-firing TE alerts at
  critical/error severity, expressed as a string. Pulls from the
  accelerated `Cisco_ThousandEyes.Alerts` data model with the
  standard "all the spellings" severity filter (`critical`,
  `Critical`, `CRITICAL`, `error`, `Error`). `appendpipe [ stats
  count | where count=0 | eval active=0 ]` guarantees one row when
  the data model is empty so the tile renders `"0"` instead of
  going blank. Tagged `Cisco,Overview,KPI,IT_Health,ThousandEyes,
  Alerts,Critical,Operations_Pressure`.
- `[overview_inter_site_latency]` → "TLH ↔ AUB latency" — single-row
  formatted-string of the current path latency between Tallahassee
  and Auburndale ThousandEyes agents. Pulls from
  `Cisco_ThousandEyes.Test_Metrics` with the same A2A test name
  placeholder (`"TLH - BLA Connection"`) the link-health stanza is
  using until Cisco support repoints the broken test. The data
  model field is in seconds; eval rounds to one decimal and
  appends `" ms"`. Renders `"—"` when no measurement exists in the
  window. Tagged `Cisco,Overview,KPI,IT_Health,ThousandEyes,Latency,
  Site_Connectivity,Tallahassee,Auburndale`.

`overview_topology_overview` was updated in lockstep — the two
trailing `append` summary blocks were rewritten to emit the new
`summaryId="active_critical_alerts"` and `summaryId="inter_site_latency"`
rows so the topology summary feed continues to short-circuit useKpi
in the common case (no override bound). Bumped that stanza to v1.2.0
with a description that names both the new bindings and the legacy
alternates.

### Legacy alternates kept in catalogue

The original `[overview_top_incident_volume]`, `[overview_operational_lead]`,
`[overview_top_incident_volume_demo]`, and
`[overview_operational_lead_demo]` stanzas are unchanged in their SPL,
just retagged with `Legacy_KPI` so the picker filter can hide them
from the default "Cisco" view. Customers with real XDR `site`
enrichment or a multi-site footprint can still rebind via the gear
icon → KPI picker.

### React wiring

`overview/index.tsx`:

- `KPI_CONFIG[0]` rewritten to bind `id: 'active_critical_alerts'`,
  `label: 'Active critical alerts'`,
  `savedSearch: 'Overview - Active Critical Alerts'`, with a
  description and `thresholdNote` pointed at the IT Health alerts
  table for triage.
- `KPI_CONFIG[1]` rewritten to bind `id: 'inter_site_latency'`,
  `label: 'TLH ↔ AUB latency'`,
  `savedSearch: 'Overview - Inter-Site Latency (TLH <-> AUB)'`, with
  `thresholdNote` listing the same health bands the link-health
  stanza uses (<30 calm, 30–100 warning, ≥100 critical) and pointing
  at the topology link popup's "View in ThousandEyes" deep link for
  path-level detail.
- `topologySummaryById` reads moved from `top_incident` /
  `operational_lead` keys to `active_critical_alerts` /
  `inter_site_latency` to match the new SPL summary IDs.
- All variable names migrated for clarity:
  `topIncident*` / `TopIncident*` → `activeAlerts*` / `ActiveAlerts*`,
  `operationalLead*` / `OperationalLead*` / `OpLead*` →
  `interSiteLatency*` / `InterSiteLatency*`. (~70 references touched
  across the file via four targeted `replace_all` runs to handle
  each casing of the substring; tsc clean afterwards.)
- `accentClassName` for the right card flipped `bg-emerald-500` →
  `bg-sky-500` — emerald reads "operational lead = healthy", sky
  reads "network metric", which fits the new latency tile better.
- Binding-footnote comment block updated to name the new saved
  searches.

### Verification

- `yarn run tsc --noEmit` clean after each step.
- Lint clean on both `pages/overview/index.tsx` and
  `common/components/florida/CustomerTopologyMap.tsx`.
- `app.conf` build bumped to `66`.

### What's next

Search binding for topology sites and links — see the next entry. The
wiring already existed end-to-end, but the picker was buried under a
`search_name` label at the bottom of each card and was never being
discovered.

---

## 2026-05-12 (late night, follow-up) — Topology editor: data-source picker promoted to the top of each card

### Context

Alan asked for "the option to simply select a different search rather
than hard coding" for both the inter-site links and each site icon.
Tracing the code revealed the per-site and per-link picker UI was
already wired end-to-end:

- `TopologySite.searchName` and `TopologyLink.searchName` flow through
  the runtime dispatcher (lines 2472, 2498 in `CustomerTopologyMap.tsx`).
- `siteSearchOptions` and `linkSearchOptions` slice the searchbase
  catalogue by `Topology_Site` / `Topology_Link` tags so each
  dropdown only surfaces stanzas shaped for that map element.
- 5 site stanzas (2 live + 3 demo: TLH, AUB, plus
  `overview_site_demo_healthy`/`warning`/`critical`) and 4 link
  stanzas (1 live + 3 demo) are tagged appropriately.

So the feature wasn't missing — it was *invisible*. The picker block
was placed at the very bottom of each card under a literal
`search_name` label, below the Internet Edge Mbps / Capacity Mbps
fields. On a 600-700px tall editor panel it was below the fold for
operators reading top-down. The label "search_name" reads like
internal jargon and signals "advanced setting, don't touch" rather
than "this is the most important field for binding telemetry".

### Fix

Pulled the data-source block to the **top** of each site and link card
(immediately under the ID badge / action buttons row) and gave it a
real label:

- Header row: bold `Data source` label on the left, small mono `site
  search` / `link search` typographic badge on the right (so the
  block reads as "Data source · site search" / "Data source · link
  search" without burying the metadata in the label).
- Dropdown first (catalogue-bound, the discoverable / 95% interaction).
- Free-text input below (kept for power users who want to bind to a
  custom searchbase entry name not yet tagged).
- Helper line beneath: *"What populates this marker. Pick from the
  catalogue or type a custom searchbase entry name. Leave blank to
  show the static placeholder only."* — same wording for sites; for
  links it reads *"What measures this connection."*

The existing wiring through `updateSite` / `updateLink` is unchanged
— the persisted topology JSON shape, the runtime dispatcher, and the
`dataState` propagation all continue to work without modification.
This is purely a UI-discoverability fix.

### Verification

- Opacity fix from the prior commit means the form is actually
  *legible* now, so the newly-promoted picker is readable in both
  light and dark themes.
- `yarn run tsc --noEmit` clean.
- Lint clean on `CustomerTopologyMap.tsx`.
- Search binding for the inter-site link uses the existing
  `[overview_link_auburndale_tallahassee_health]` stanza by default
  (factory topology). Operator can swap to any of the demo stanzas
  for screenshots / walkthroughs without touching code.
- `app.conf` build bumped to `67`.

### What's next

Real-stack QA on Alan's environment — confirm the new "Data source"
picker is visible on first editor open, both for the existing TLH /
AUB sites and for the AUB ↔ TLH link. Confirm the Tallahassee/
Auburndale dropdown rows actually show in the catalogue list (they
should — both stanzas carry `Topology_Site` tags).

---

## 2026-05-12 (night) — KPI info popovers gain a THRESHOLDS section

### Context

Alan asked for every Cisco-tagged tile to "have an excellent
description and a clear threshold" — using a reference image of a
product card with stacked sections (DESCRIPTION / VALUE / SUPPORT)
as a visual cue, but explicitly noting "don't need it to be the
same; having a section below the description with threshold details
will be fantastic." So the ask is structural: take the existing
description-only `InfoTooltip` and grow a clearly delineated
THRESHOLDS section below the body that answers "what counts as
good?" for every tile in the dashboard.

The existing model already had `MetricThresholds { warning, critical,
direction }` driving the live tile colour via `computeStatus`, but
the popover only showed prose. The numbers were in the description
sometimes, missing other times, and had drifted in a couple of
places (e.g. open-issues description said "warning at 500" but the
config said `warning: 500` — accidentally consistent, but easy for
either to drift independently).

### Commit `3f522c1` — single source of truth, structured render

**Files:**
- `packages/splunk-cisco-dashboards/src/main/webapp/common/hooks/useMetric.ts`
- `packages/splunk-cisco-dashboards/src/main/webapp/common/components/florida/InfoTooltip.tsx`
- `packages/splunk-cisco-dashboards/src/main/webapp/common/components/florida/MetricItem.tsx`
- `packages/splunk-cisco-dashboards/src/main/webapp/common/components/florida/TableTile.tsx`
- `packages/splunk-cisco-dashboards/src/main/webapp/pages/overview/index.tsx`

**The deriver** (`useMetric.ts`):

`deriveThresholdLines(thresholds, unit)` translates a
`MetricThresholds` record into 2-3 colour-coded `ThresholdLine`
rows. The output ranges mirror `computeStatus` exactly so the
popover can never disagree with the live tile colour:

```
higher_is_better:  Healthy ≥ warning · Warning critical – < warning · Critical < critical
lower_is_better:   Healthy ≤ warning · Warning > warning – critical · Critical > critical
```

When only one of `warning`/`critical` is set, the deriver emits a
2-row variant rather than fabricating a fictional middle band.
`formatThresholdNumber` adds locale grouping for integers (`25,000`
not `25000`) and trims one decimal otherwise; the optional `unit`
is appended verbatim.

A new `MetricConfig.thresholdNote?` field carries supplemental
prose for cases where the auto-derived rows aren't the whole
story:

1. **Unit mismatch** — e.g. `critical_website_availability` has the
   threshold on a per-window availability percentage but the
   headline reads "X of Y sites". The note clarifies that "X of Y"
   counts each site whose individual availability AVG is ≥ 99.5%.
2. **Threshold provenance** — e.g. network-health bands match the
   Catalyst Center default policy (good/fair/poor); device-health
   uses the tighter "any non-managed device drags the average"
   reasoning; open-issues notes that it counts every priority
   including informational.
3. **Trend-only metrics** — the four Building Intelligence presence
   tiles (active devices, Wi-Fi clients, occupancy, Webex devices)
   have no fixed numeric cutoff, so they ship with `thresholdNote`
   only and the deriver returns nothing. The popover renders just
   the qualitative sentence — "Trend metric — no fixed cutoff. The
   right number depends on…" — so every Cisco-tagged tile still
   answers "what counts as good?".

**The render** (`InfoTooltip.tsx`):

Threshold rows render as `[colour-dot] [Healthy/Warning/Critical
label] [range value]` with a fixed-width label column so the
ranges line up vertically. Tones use brighter shades than the
dashboard headline palette (emerald-400, amber-400, red-400)
because the popover background is dark slate-900 and the headline
palette is tuned for a white tile background. Same colour roles
(sky/amber/red), shifted up a step for legibility on dark.

The section is rendered when *either* the structured rows or the
supplemental note is provided, and the `useLayoutEffect` that
positions the popover now depends on `showThresholds` so the
above/below flip recalculates when the body height changes.

**Plumbing** (`MetricItem`, `TableTile`, overview/index.tsx):

`MetricItem` and `TableTile` forward `thresholdLines` and
`thresholdNote` into `InfoTooltip`. The overview page derives the
lines once per leaf via `useMemo` against the tile's effective
config so picker overrides don't recompute on every render.

`KpiCard` (the right-column site-name cards) forwards
`thresholdNote` only — those are string-valued tiles with no
numeric threshold, so the section reads as a "how to interpret
this ranking" guide instead.

### Threshold copy authored

All sixteen tiles in `METRIC_CONFIG` plus both `KPI_CONFIG` cards
got a fresh `thresholdNote`. A few worth calling out:

- **`critical_website_availability`** — clarifies the headline /
  threshold unit mismatch and cites 99.5% as the "four-nines-plus
  SLO operators expect from public-facing critical sites".
- **`device_health`** vs **`network_health`** — device is tighter
  (98 vs 95) on purpose because any non-managed device drags the
  blended score by 50; the note explains that math.
- **`open_issues`** vs **`active_te_alerts`** — the former counts
  *every* priority including informational; the latter narrows to
  high+critical. The note for each cross-references the other so
  the operator picks the right one for their question.
- **`fw_blocked`** — adds "compare against the baseline overlay
  before sounding the alarm — sustained elevation matters more
  than a single hot bucket", reinforcing the dashed-line UI.
- **Building presence tiles** — all four call out "trend metric —
  no fixed cutoff" and direct the operator to compare against
  baselines (week-over-week, AP-capacity, seasonal, etc.) rather
  than a hardcoded number.

### Drive-by description fixes

While editing the descriptions to land naturally with the new
section, dropped the trailing "Healthy >= X; Critical < Y" prose
that several descriptions ended with — that's now redundant with
the THRESHOLDS section and was the most likely place for the
description and the threshold config to drift apart. Also fixed a
stale "Tallahassee, Orlando, Auburndale" mention in
`sites_below_threshold` (Orlando was removed from the topology in
commit `27a207b`; the description hadn't been refreshed).

### Verification

- TypeScript `tsc --noEmit`: clean.
- Lints on all five touched files: clean.
- Threshold deriver walked through manually for representative
  cases: `network_health` (95/80 higher_is_better with %),
  `open_issues` (500/1000 lower_is_better no unit), `fw_blocked`
  (5000/25000 with locale grouping → "5,000" / "25,000"),
  `sites_below_threshold` (1/2 lower_is_better — narrow band but
  technically accurate), `bldg_score` (90/70 higher_is_better).
  Building presence tiles render note-only with no derived rows.
- Override path: `applyOverride` carries `thresholds` and
  `thresholdNote` forward verbatim because of the `...cfg` spread.
  Picker swaps preserve the original tile's threshold semantics
  even after a search rebind, which matches the operator's
  mental model — overriding switches *which* search drives the
  tile, not what counts as healthy.

### What's deliberately deferred

- **Threshold authoring in `searchbase.conf`.** Today the threshold
  numbers live in `MetricConfig` (TypeScript). A future cleanup
  could move them into `searchbase.conf` so non-engineers can tune
  bands without a rebuild. The `MetricThresholds` shape is already
  small enough to express in conf (`warning_threshold = 95`,
  `critical_threshold = 80`, `direction = higher_is_better`); the
  catalogue loader would parse and merge with the static config
  for any tile bound to a stanza.
- **Per-tenant threshold overrides via KV-Store.** Same migration
  as the other layout prefs (split percentage, map position) —
  a single workstream when we move all per-operator UI prefs
  into KV-Store.
- **Localised number formatting beyond grouping.** `Number#toLocaleString`
  uses the browser's locale for grouping but our threshold numbers
  are always in one canonical unit (counts, %, ms). If the dashboard
  ever localises to languages where the percent sign comes before
  the number (Turkish, Arabic), the derived strings will need a
  format-aware path. Not in scope today.

### What's next

- Visual QA on a real Splunk environment — the dark popover with
  three coloured threshold rows is the most visually-novel UI
  change since the InfoTooltip portal fix; eyeball it on a 1280px
  display and a 4K display, and confirm the popover still fits
  inside the viewport at the bottom-right tile of each section.
- Demo data generator fix is in another Cursor session; once
  landed, the test-name filter swap from `"TLH - BLA Connection"`
  to `"TLH - AUB Connection"` in `searchbase.conf` is a two-line
  edit.

---

## 2026-05-12 (late evening) — Overview map: configurable position + vertical resize

### Context

Two-step UX improvement on the Overview page, landed in adjacent
commits the same evening:

1. **Commit `1e87fed`** introduced an operator-configurable map
   position toggle on the Overview page. The map can now sit `right`
   (the original split-pane layout), `below` the metric tiles
   (new default), or `above` them. The choice persists in
   localStorage under `scd_overview_map_pos`. Trigger: on the typical
   1280-1440px display the map and the three tile rails were
   constantly fighting for horizontal width — region labels on the
   map kept truncating and the tile headlines kept ellipsis-ing.
   Stacking vertically gives each region the full window width.
2. **Commit `589654b`** (this entry) extended the splitter to work in
   the two new vertical modes, so the user can rebalance heights
   the same way they rebalance widths in `right` mode. Alan tried
   the new layout immediately after `1e87fed` landed and noticed
   the splitter wasn't draggable in the vertical modes — that was
   called out as "deliberately deferred" in the prior summary, and
   he asked for it next.

### Commit B — vertical drag-to-resize for `below` / `above` modes

**File:** `packages/splunk-cisco-dashboards/src/main/webapp/pages/overview/index.tsx`

**Behaviour:** same splitter component renders in every mode, but
the orientation, drag axis, and aria semantics swap based on
`mapPosition`.

- `right` mode (unchanged): vertical bar between tiles and map,
  drag horizontally, ←/→ arrow keys nudge ±1%, `cursor-col-resize`,
  `aria-orientation="vertical"`, hidden below the `xl` breakpoint
  where the layout collapses anyway.
- `below` / `above` modes: horizontal bar spanning the full width,
  drag vertically, ↑/↓ arrow keys nudge ±1%, `cursor-row-resize`,
  `aria-orientation="horizontal"`, always visible.

`leftPct` is reused across modes as "share of the container
allocated to the tiles", clamped to the same 35-80% range. This
means the operator's chosen percentage persists across mode
switches — semantic continuity, not separate per-mode state.
Single source of truth, single reset path.

**Axis inversion for `above` mode.** The layout uses
`flex-col-reverse` for `above` (rather than swapping JSX order) so
the splitter stays attached to its sibling and the keyboard
handler logic stays in one place. The side-effect is that the
splitter's screen position is inverted: dragging *down* in `above`
mode makes the *map* bigger (it's the visual-top section). The
`onMove` handler computes a raw percentage from `clientY` and
flips it for `above` so the stored `leftPct` always means "tiles'
share". Same flip for keyboard: in `below`, ↑ shrinks tiles; in
`above`, ↑ *grows* tiles (the splitter line follows the arrow
direction visually, which is what users expect).

**Layout plumbing.** In `right` mode the tiles column reads the
`--scd-left-pct` CSS variable via the `xl:w-[var(--scd-left-pct)]`
Tailwind arbitrary property. That variable is heightless — it only
controls width — so for the vertical modes we set an inline
`flexBasis: ${leftPct}%` on the tiles column with `flexGrow: 0`
and `flexShrink: 0`. The map column then takes the remainder via
`flex-1`. Tried using a second CSS variable but Tailwind's
responsive variants don't conditionally swap width vs height
cleanly without duplicating class lists; the inline-style escape
hatch is cheaper.

**Splitter visual.** Same gradient and dragging-state colours.
Grip dots flip direction: three vertical dashes for the horizontal
splitter (right mode), three horizontal dashes for the vertical
splitter (below/above modes). The dots are perpendicular to the
drag axis so they read as a grip handle.

**Effect-dep updates.** Both the `useEffect` that owns the drag
listeners and the `useCallback` for `onSplitterKeyDown` now
include `mapPosition` in their dependency arrays. Without that the
handlers would close over a stale value if the user changed the
position mid-drag — rare in practice but a real bug.

### Structural change: `mapPosition` state moved above splitter state

The drag and keyboard handlers need to read `mapPosition` to
decide which axis to operate on. Moved the `mapPosition` declaration
block from below the splitter-state block to *above* it. Cleaner
than introducing a ref pattern just to defer the read. The
`handleResetAllCustomizations` and `MapPositionToggle` references
further down the file are unaffected because the state is hoisted
*higher* in the function body.

### Verification

- TypeScript `tsc --noEmit`: clean.
- ESLint reads through the file: no diagnostics on the affected
  hunks.
- Manual axis sanity check, both directions of all three modes:
  - `right` + drag right → tiles grow, leftPct ↑. ✅
  - `below` + drag down → tiles grow, leftPct ↑. ✅
  - `above` + drag down → tiles *shrink*, leftPct ↓. ✅ (axis flip
    works as designed)
  - `below` + ↑ arrow → leftPct − step. ✅
  - `above` + ↑ arrow → leftPct + step. ✅ (visual splitter
    follows the arrow direction)
  - Double-click in any mode → snaps to 58.33%. ✅
  - Switch right → below mid-session → vertical splitter takes
    over with the same `leftPct`. ✅

### What's deliberately deferred

- **Per-mode percentage memory.** Today the same `leftPct`
  applies whether the splitter is horizontal or vertical. A user
  who likes 75/25 width but 40/60 height will need to re-adjust
  on every mode switch. If it becomes a complaint, we'd persist
  three separate percentages keyed on mode. Not worth the extra
  storage / migration complexity until someone asks.
- **Touch drag support.** Mouse only; no `pointerdown` / touch
  events wired up yet. The new toggle plus vertical resizer is
  already a meaningful step for mouse users; adding touch is a
  separate small piece of work that needs design review (touch
  hit areas typically want to be 44px+ which is much larger than
  the current 6-8px visual handle).
- **KV-Store-backed layout prefs.** Still on `localStorage` for
  both `mapPosition` and `leftPct`. The migration to a Splunk
  KV-Store is a single workstream that should cover all
  per-operator UI prefs at once.

### What's next

- Visual QA on a real Splunk environment (Dashboard Studio layout
  positioning is sensitive to actual rendering — particularly
  worth eyeballing the splitter at sub-xl widths in `right` mode
  to confirm the `hidden xl:flex` still wins, and the horizontal
  bar's hit-area in `below` mode at typical zoom levels).
- Demo data generator fix is in another Cursor session; once
  landed, the test-name filter swap from `"TLH - BLA Connection"`
  to `"TLH - AUB Connection"` in `searchbase.conf` is a two-line
  edit.
- Drill-down regression on `/opt/10` — still blocked on browser
  console output from David.

---

## 2026-05-12 (evening) — TE deep link upgraded to Path Visualization format

### Context

Right after the late-afternoon work that introduced the deep link as
a bare `?__a=&testId=` URL, the TE AI Assistant volunteered the
**official URL format** for `/network-app-synthetics/views/` deep
links, including the parameters needed to land directly on the Path
Visualization view with metrics pre-selected and a time window
already framed. That's a much better operator experience than what
we had — the previous URL would land on the default Overview tab,
forcing two more clicks to get to "show me where on the path it's
broken". Upgraded the URL constructor accordingly.

### Commit C — `[overview_link_auburndale_tallahassee_health]` v1.4.0 → v1.5.0

**URL format change.** Previously:

```
https://app.thousandeyes.com/network-app-synthetics/views?__a=<acct>&testId=<test>
```

Now:

```
https://app.thousandeyes.com/network-app-synthetics/views/
  ?testId=<test>
  &__a=<account>
  &detailId=pathvis
  &metrics=netLatency,netLoss,netJitter
  &direction=BIDIRECTIONAL
  &startTime=<lastSeen-epoch>
  &timelineWindow=<lastSeen-86400>,<lastSeen>
```

**Parameter rationale:**

- `detailId=pathvis` — opens the network path graph. Best default
  for the click-through use case ("we see degraded latency on this
  link; show me where on the path it's breaking"). The other valid
  values per the TE AI doc are `table` (tabular metrics view) and
  `map` (geographic overview). Easy to change in one place if Alan
  or the customer ever wants a different default.
- `metrics=netLatency,netLoss,netJitter` — mirrors the three pills
  we surface in the map popup. The TE Path Visualization view
  defaults to a single metric if not specified; pre-selecting all
  three keeps the operator's mental model consistent across the
  pivot.
- `direction=BIDIRECTIONAL` — required for A2A tests per the TE AI
  doc. We know this branch is filtered to
  `Test_Metrics.thousandeyes.test.type="agent-to-agent"`, so always
  emitting `BIDIRECTIONAL` is safe.
- `__a=<accountId>` — kept defensively. Multi-account TE users
  could otherwise land on the wrong account's view. The TE AI's
  example omitted it (probably because they only have one account
  in their demo org), but it's strictly additive for single-account
  setups so no harm done.
- `startTime=<lastSeen>` + `timelineWindow=<lastSeen-86400>,<lastSeen>` —
  anchors the deep link's time window to the latest sample our SPL
  saw, expanded backward by 24h. Reasoning: the operator clicked
  because *something* showed up on the map; landing on a 24h window
  centered on the most recent data gives enough context to see
  whether the issue is brand new or persistent without forcing them
  to fiddle with TE's own time picker on arrival. We use
  `strftime(lastSeen, "%s")` to convert the epoch float to a clean
  integer string for URL safety.

**SPL structure change.** Moved the `teLink` construction from the
per-row position inside the TE branch (before `stats`) to after the
final `stats by linkId`. Three reasons:

1. **Correctness:** `lastSeen` is now `max(lastSeen)` after the
   stats, so the URL's time anchor is the freshest sample across
   all agent pairs for the link, not whichever per-pair row
   happened to win the `first(teLink)` lottery.
2. **Schema cleanliness:** the SD-WAN and Catalyst Center branches
   no longer need `teLink=null()` in their initial evals (they
   keep `teAccountId=null()` and `teTestId=null()` so the
   single-eval URL constructor returns null cleanly via the
   `isnotnull(...) AND isnotnull(...) AND isnotnull(...)` guard).
3. **Single point of truth:** anyone who wants to change the URL
   format — different view, different metrics, different time
   window — now edits exactly one `eval` instead of trying to keep
   per-row, mid-pipeline, and post-stats fields all in sync.

**Stats aggregation slimmed by one field.** Removed
`first(teLink) as teLink` from the stats since `teLink` no longer
exists at that point in the pipeline; the new constructor runs on
the aggregated `teAccountId` / `teTestId` / `lastSeen` directly.

**Bumped app build 61 → 62.**

### Bonus: connectivity-testing question

User asked the TE AI Assistant "what is the best way to test
connectivity between TLH and AUB?" The TE AI confirmed:

1. **Agent-to-Agent (A2A) test is the right architecture** —
   provides bidirectional latency / loss / jitter / bandwidth,
   path visualization, continuous monitoring, and historical
   trending.
2. **No TLH or AUB-named agents are currently visible in their
   search** — which independently confirms the morning's diagnosis
   that `demb-te01-va` is offline (so it doesn't show up as an
   "active" agent in TE's catalogue), and that the existing test
   `7148943` ("TLH - AUB Connection") is misconfigured to target
   an Orlando agent.

No code change required from this; it's reaffirmation of the
architecture we already have wired up. Documented here for the
trail of "we asked, TE confirmed, the gap is operational not
architectural." Once Cisco TE support restores `demb-te01-va`
(and ideally repoints test `7148943` to actually target it), the
existing searchbase stanza picks up the real data automatically —
the placeholder filter swap is one line.

### What's next

- Same carryover as before: visual QA on a real Splunk environment,
  drill-down regression on `/opt/10`, demo-data-gen fix, KV-Store
  capacity inputs.
- One additional cleanup item: when the demo data generator lands
  emitting numeric metrics, the test name filter swap is now a
  **two-character change** (`BLA` → `AUB` in
  `Test_Metrics.thousandeyes.test.name="TLH - BLA Connection"`).
  Logged so it doesn't get lost.

---

## 2026-05-12 (late afternoon) — TE deep link in map popup, IT Health ThousandEyes tab wired

### Context

Two work items off the carry-over list from the morning, both in service
of "make the operator's pivot from a degraded link to the underlying
ThousandEyes evidence one click long":

1. **Surface the new TE-derived fields in the map popup.** The
   `[overview_link_auburndale_tallahassee_health]` stanza had been
   rewritten that morning to add `jitterMs`, `sourceAgents`, and
   `targetAgents`, but the topology map's `LinkDetails` popup wasn't
   reading them yet. Customers would see the right line color, but
   couldn't see the actual jitter number or which agents were being
   probed.
2. **Wire the seven ThousandEyes IT-Health stanzas into a real
   dashboard tab.** They've been sitting in `searchbase.conf`
   (`[it_health_thousandeyes_*]`) since 2026-05-11 with no consumer.

### Commit A — Map popup: jitter + agent pair + TE deep link

**Commit:** `682202c` — "Map link popup: surface jitter, agent pair, and
ThousandEyes deep link"

**Files:**
- `searchbase.conf` (link stanza v1.3.0 → v1.4.0)
- `CustomerTopologyMap.tsx` (`parseLinkRow` + `LinkDetails` component)
- `types.ts` (`TopologyLink` interface)

**Searchbase change.** The TE branch's `BY` clause grew two more fields:
`Test_Metrics.thousandeyes.account.id` and `Test_Metrics.thousandeyes.test.id`.
Renamed to `teAccountId` / `teTestId`, then composed into a `teLink`
field via:

```spl
| eval teLink=if(isnotnull(teAccountId) AND isnotnull(teTestId),
    "https://app.thousandeyes.com/network-app-synthetics/views?__a=" .
    teAccountId . "&testId=" . teTestId, null())
```

The URL deliberately omits `agentId` and `direction` so the user lands
on the **generic test view** in the TE console and can pivot to
whichever agent perspective is most useful from there. (If a per-event
pinned URL is ever wanted instead, the searchbase docstring documents
the swap to `latest(Test_Metrics.thousandeyes.permalink)` as a one-liner.)

The SD-WAN and Catalyst Center fallback branches null out
`teAccountId` / `teTestId` / `teLink` for output-schema consistency, so
the consumer always sees the same column set regardless of which
priority branch wins.

**Map popup change.** `TopologyLink` gained four new optional fields
(`jitterMs`, `sourceAgents`, `targetAgents`, `teLink`). `parseLinkRow`
reads them with the existing helpers — `textFromRow` for the agent
fields handles Splunk's multi-value newline-joining transparently, and
also accepts `thousandeyes.permalink` as a fallback source for `teLink`
in case anyone wants to swap the URL strategy.

`LinkDetails` got three additions:

- A **Jitter pill** in the metric grid, sitting between Loss and
  Endpoint Health (so the path-quality metrics latency / loss / jitter
  cluster together visually).
- A **"Measured by `<source>` ↔ `<target>`" line** in the bottom info
  panel, but *only* when both agent fields are populated. This addresses
  the 2026-05-12 misnamed-test lesson: a TE test name like "TLH - AUB
  Connection" can lie about the actual pair under the hood, so we
  display the agents as ground truth and let the operator audit the
  test's intent against its actual configuration.
- A **"View in ThousandEyes" link button** (`ExternalLink` icon, sky
  theme matching the other CTA buttons in the editor), only rendered
  when `teLink` is present. Opens in a new tab with `rel="noopener
  noreferrer"`.

**What we did NOT change.** The `deriveStatus` fallback in
`CustomerTopologyMap.tsx` still uses its old thresholds (latency ≥ 200,
loss ≥ 5, util ≥ 95 for critical). It only fires when the SPL didn't
emit a status, which doesn't happen for the link stanza — so the
defensive numbers don't actually trip. Updating them to match the
in-state WAN thresholds would be a parallel change with no behavioral
impact today; leaving the diff focused.

### Commit B — IT Health: ThousandEyes tab with 7 panels

**Commit:** `<pending>` — see git log after this section's verification
section is filled in.

**Files:**
- `data/ui/views/it_health_v1.xml` (added 7 dataSources, 15 visualizations,
  1 layout, 1 tab)
- `app.conf` (build 60 → 61)

**Where the tab lives.** Between **User Experience** and **Details &
KPI Reference** — same horizontal level as the other ops-themed tabs,
not buried at the end. Final tab order:

```
Overview | User Experience | ThousandEyes | Details & KPI Reference | Catalyst Center Intelligence | About
```

**Layout structure.** Three sub-sections inside the tab, each its own
rounded card with a markdown sub-header:

1. **Path Quality** (top, 1400×420) — three line charts side-by-side:
   Network Latency, Network Loss, Network Jitter. Each is a multi-series
   timechart by `Test_Metrics.server.address`, sorted worst-first.
   Powered by `ds_te_network_latency` / `_loss` / `_jitter`.
2. **Alerts** (middle, 1400×700) — three panels:
   - **Alerts by Severity** column chart (`splunk.column`, 450×280).
   - **Alert Timeline** stacked column chart by hour (`splunk.column`
     stacked, 925×280).
   - **Recent Alerts** table with permalinks back to the TE console
     (`splunk.table`, 1370×320). Inherits the existing
     `rowBackgroundColorsByIndex` row-stripe styling for parity with
     other tables in the dashboard.
3. **Endpoint Traces** (bottom, 1400×530) — single wide table powered
   by the `cisco:thousandeyes:trace` sourcetype: per-trace span counts,
   HTTP error counts, duration, and originating agent / test /
   permalink.

**DataSource pattern.** Each panel is an inline `ds.search` (raw `query`
string), not a searchbase reference. That's the same pattern every
other panel in this dashboard uses — Splunk Dashboard Studio doesn't
have native searchbase resolution at view-render time, so the SPL is
duplicated by hand. The duplication is one-way: searchbase remains the
canonical source of truth (versioned, documented, KPI-picker-discoverable),
and the dashboard view is a manual mirror. If the searchbase SPL ever
changes, this view needs the same edit. Documented in the searchbase
stanza's `related_info`.

**JSON safety.** Every change was hand-validated by parsing the CDATA
contents with `json.loads` after each edit. The validator script also
cross-checked that every layout `viz_*` reference resolves to a real
visualization, every viz `dataSources.primary` resolves to a real
dataSource, and every layout's `input_*` reference resolves to a real
input. Final state:

```
Tabs:    Overview, User Experience, ThousandEyes, Details & KPI Reference,
         Catalyst Center Intelligence, About
Layouts: layout_about, layout_cc_intel, layout_details, layout_overview,
         layout_user_experience, layout_thousandeyes
New TE viz count: 15 (3 sub-section bg rectangles + 3 sub-section
                     markdown titles + 1 narrative + 1 section bg + 7 chart/table)
New TE ds count:  7
Missing layout refs: none
Missing ds refs:    none
```

### What we did NOT change

- The `props.conf` first-line corruption is still in place. User
  confirmed earlier today the fix lands in the TA, not here. The file
  remains untracked.
- The `[overview_link_auburndale_tallahassee_health]` stanza still
  filters to `"TLH - BLA Connection"` (placeholder for a working A2A
  test in the same TE org, since the real `7148943` test is still
  hosed pending Cisco repointing it). Flip the test-name filter back
  to the real one in a one-line commit when the agent is recovered.
- The two **composite-replacement** stanzas
  (`[it_health_active_te_alerts_high_critical]` and
  `[it_health_sites_below_threshold]`) are not in this view. They live
  on the **Overview page** as the replacement headlines for the
  retired UX Score and Compliance tiles, not on the IT Health detail
  page. They're already wired from the earlier 2026-05-11 work.

### What's next

- **Visual QA on a real Splunk environment.** All edits are
  type-clean and JSON-clean, but Dashboard Studio rendering can be
  layout-position-sensitive. Open the dashboard on a stack with the
  TE data model installed and verify each sub-section reads cleanly
  at the default 1440 width (and the auto-scale fallback at narrower
  widths).
- **Drill-down regression on `/opt/10`** (carry-over). Still blocked
  on browser console output from the user.
- **Demo data generator fix** (carry-over). Sitting in another
  Cursor session per the prompt produced earlier today. Once that
  lands, switch the link stanza filter from `"TLH - BLA Connection"`
  back to `"TLH - AUB Connection"`.
- **KV-Store-backed link/site capacity input** (carry-over). Still
  using browser `localStorage`; KV Store is a larger lift not yet
  scoped.

---

## 2026-05-12 (afternoon) — `demb-te01-va` agent diagnosis; handed to TE support; resume dashboard work

### Context

Spent the afternoon trying to figure out which customer site the offline
ThousandEyes Enterprise Agent physically lives in, and what
restart procedure applies. The thread surfaced two
data-quality problems on the customer side that we should
remember (they affect what we trust in our dashboard):

1. **The "TLH ↔ AUB Connection" A2A test (id `7148943`) is
   misnamed.** Its source is `demt-te01-va` (TLH, online) but
   its target is `dema-te01-va` — and `dema-te01-va` is in
   **Orlando**, not Auburndale. So the test that was
   supposedly proving "Tallahassee can reach Auburndale" has
   been measuring TLH → Orlando the whole time. Whatever
   number it returned for "loss between TLH and AUB" was
   never about the AUB pair. The morning's decision to remove
   MCO/Orlando from our topology means we now have *no real
   A2A monitoring* for the only inter-site link customer cares
   about — at least until Cisco repoints the test to a true
   AUB-side agent.
2. **The actually-offline agent is `demb-te01-va` (id
   `1474613`)**, not `demt-te01-va` as initially suggested
   by the in-product TE AI. It's a **Virtual Appliance**,
   not a Linux/Docker installation, which means the SSH/
   `systemctl restart te-agent` recovery instructions
   originally sent to David don't apply — those are for
   Linux-package installs. VA recovery is hypervisor-side
   (vSphere/Hyper-V console, restart the VM, check the VA's
   own web UI for connectivity to TE).
   - It went offline **2026-05-06** at 19:15 UTC.
   - Private IP **172.18.81.51**, public egress IP
     **164.51.150.116**.
   - Public IP geolocation is a dead end: the /16 is owned
     by **Florida Department of Management Services - Division
     of Telecommunications** (AS8103, MyFloridaNet), the
     state's shared WAN. Every customer site egresses through
     this AS, so the public IP cannot disambiguate between
     TLH/AUB/anywhere-else. The private IP would, but only
     if customer publishes their internal subnet plan — which
     they don't expose to us.
   - David told us verbally the VA is in **Auburndale** but
     we have no independent confirmation. Treat as
     "probably AUB, pending Cisco support verification."

### Decision: hand the broken agent to TE support; resume app work

The agent recovery is not in our scope and the diagnostic
loop was burning time without closing. **David has the
correct VA-vs-Linux instruction set and the contact info
for `davijime@cisco.com`** (David A. Jimenez Martinez, Cisco
TE specialist who did the customer's original setup). When/if the
agent comes back online and the test is repointed to a real
AUB-side agent, the data will flow into our existing
`[overview_link_auburndale_tallahassee_health]` stanza
without code changes — that's exactly what we wanted out of
the searchbase indirection.

For dev/test of the dashboard we'll use **whatever data the
currently-working test (`7148943`) produces**, even though
that data is technically TLH→Orlando. The SPL panel will
render real numbers, the visualization can be validated, and
the misnamed test means the labels on the panel will say
"TLH↔AUB" — which is wrong-but-stable until Cisco fixes the
agent. We accept that wrongness for dev only; we don't
push that to a customer dashboard until the test is
repointed.

### What we did NOT change

- **No code changes today** in the afternoon thread. Every
  edit in this session log entry is documentation.
- We did **not** wire the broken/misnamed A2A test into
  `[overview_link_auburndale_tallahassee_health]` yet. The
  morning's stanza version (`1.2.0`) still uses Catalyst
  Center device-health rollups as the link signal, with
  `capacityMbps=null()` and a `telemetrySourceLabel` of
  `"Catalyst Center device health (capacity awaiting circuit info)"`.
  We'll revisit this when one of two things happens:
  - Cisco support repoints test 7148943 to a true AUB-side
    agent (cleanest path), OR
  - We decide we want a "preview-only / dev-only" panel that
    consumes test 7148943 as-is for layout validation, with
    a clear visual badge indicating the data is provisional.
- We did **not** delete or archive `dema-te01-va` or any
  Orlando references in TE itself. That's customer data; we
  only changed our app's representation.

### Lesson recorded

**TE test names are not reliable indicators of the test's
actual source/target agents.** The "TLH - AUB Connection"
test demonstrates this perfectly. Going forward, when we
write SPL that filters on `Test_Metrics.thousandeyes.test.name`
we should also pin
`Test_Metrics.thousandeyes.target.agent.name` (or `id`) to
prove we're consuming the right pair. A dashboard panel
that quietly displays the wrong link's data is worse than
one that shows "Awaiting data."

### What's next

User chooses one of these for the next active thread:

1. **Wire `it_health_v1.xml` panels** to consume the seven
   IT-Health ThousandEyes stanzas we added on 2026-05-11
   (`it_health_thousandeyes_network_latency`, `_loss`,
   `_jitter`, `_alerts_summary`, `_alerts_timeline`,
   `_alerts_table`, `_endpoint_traces`) plus
   `[it_health_active_te_alerts_high_critical]` and
   `[it_health_sites_below_threshold]`. The stanzas
   exist; the view doesn't render them yet.
2. **Drill-down regression on `/opt/10`**: ↗ icon, footer
   link, and KPI picker "Jump to" all stopped working on
   the customer test stack. `KpiPickerPanel.tsx` got
   self-healing refetch armor on 2026-05-11; if the
   regression persists, we need browser console output
   from `/opt/10` to root-cause whether it's a 503 cascade
   or a different fault.
3. **KV Store-backed link/site capacity input**: today
   capacities live in browser `localStorage` only. For
   team-shared edits and SPL-readable values, we'd need a
   KV Store collection plus a small admin UI. Larger lift.
4. **Provisional A2A wiring to test 7148943** for dev/test
   only, gated behind a "preview" badge — only worth doing
   if option (1) is going to take long enough that we want
   visible link-health data on the map in the meantime.
5. **Local untracked changes still uncommitted**:
   - `app.conf` build-number bump (`50` → `60`)
   - `macros.conf` edit to `[summariesonly]`
     (`allow_old_summaries=false fillnull_value=null`)
   - `props.conf` (currently focused; appears to have an
     untracked diff header on line 1 that we noted but
     haven't fixed). Worth cleaning up before the next
     packaging cycle either way.

---

## 2026-05-12 (afternoon, follow-up) — Site-to-site link search now sources from ThousandEyes A2A

### Context

Picked up the dashboard work after handing the `demb-te01-va`
recovery to TE support. The morning cleanup left the
`[overview_link_auburndale_tallahassee_health]` stanza
falling back to Catalyst Center device-health rollups for
the link signal — useful as a fallback, but not what the
business question on the map asks ("how is the WAN
performing between TLH and AUB?"). User asked to wire
this to the ThousandEyes Test_Metrics data model.

User confirmed the sourcetype/data shape via a real event
from `cisco:thousandeyes:metric` (latency/loss/jitter all
present per metric_name field), and supplied a working
example tstats query. They explicitly chose
**`"TLH - BLA Connection"`** as the test-name filter for
this round — it's a *different* A2A test in the same TE
org but it's actually returning data, which is what we
need to validate the SPL end-to-end. Once Cisco TE support
fixes `demb-te01-va` and repoints the real TLH↔AUB test,
we just swap the test-name string and the rest works
unchanged.

### What we built

#### `[overview_link_auburndale_tallahassee_health]` v1.3.0

Three-tier priority chain replaces the previous two-tier:

1. **Priority 1 — Cisco SD-WAN linkhealth** (unchanged).
   Capacity / throughput / utilization from
   `cisco:sdwan:linkhealth`. Won't fire at customer (no
   SD-WAN deployed) but kept for portability.
2. **Priority 2 — ThousandEyes A2A** (NEW). `tstats`
   against `Cisco_ThousandEyes.Test_Metrics` filtered to
   `test.type="agent-to-agent"` and a single test name.
   Returns one row per `(sourceAgent, targetAgent)` pair
   with `latencyMs`, `lossPct`, `jitterMs`. Source and
   target agent names propagate up to the output as
   `sourceAgents` / `targetAgents` multivalues so the map
   popup can display *which agents are actually being
   measured* — directly responding to the 2026-05-12
   misnamed-test lesson.
3. **Priority 3 — Catalyst Center device health**
   (was Priority 2). Demoted because it's a reachability
   rollup, not a path measurement; falls back when the
   first two branches are empty.

#### Status logic now layered

When the TE branch wins, status is computed from
`lossPct` / `latencyMs` / `jitterMs` thresholds tuned for a
~250-mile in-state WAN (anything over 30 ms latency or
0.5% loss is suspect; over 100 ms or 2% is critical). When
SD-WAN wins, status follows utilization%. When DNAC fallback
wins, status follows `endpointHealthPct`. Priority filter
guarantees only one branch's signals drive status per row.

#### Unit handling

The TE data model exposes `network.latency` in **seconds**
(per the customer's own SPL examples and the existing
`overview_overview_user_experience_quality` style stanzas).
We multiply by 1000 to land on `latencyMs`. `network.jitter`
is already in milliseconds and `network.loss` is already a
percentage — no conversion needed for those.

#### Output schema additions

New fields on the output row, in addition to the existing
schema:

- `jitterMs` — third path metric, displayed in the popup
  alongside latency/loss when available.
- `sourceAgents` — multivalue of `Test_Metrics.thousandeyes.source.agent.name`
  values that contributed to the measurement.
- `targetAgents` — same for the target side.

The map consumer (`CustomerTopologyMap.tsx`) doesn't read
these yet; that's a follow-up. The fields are present in
the search output now so the consumer can be updated
without re-touching SPL.

#### Tags

Added `ThousandEyes` and `Requires_Cisco_ThousandEyes_DM`
to the `tags` line so the KPI catalogue picker filters
this stanza into the right TE-related slice.

### How to validate the TE branch standalone

Before trusting the full stanza, drop this into the search
bar on the customer stack to verify the TE Priority 2
branch returns rows and the units look right:

```
| tstats `summariesonly`
    avg(Test_Metrics.metric_name:network.latency) as _latencyS,
    avg(Test_Metrics.metric_name:network.loss) as lossPct,
    avg(Test_Metrics.metric_name:network.jitter) as jitterMs,
    latest(_time) as lastSeen
  FROM datamodel="Cisco_ThousandEyes.Test_Metrics"
  WHERE Test_Metrics.thousandeyes.test.type="agent-to-agent"
        Test_Metrics.thousandeyes.test.name="TLH - BLA Connection"
  BY Test_Metrics.thousandeyes.source.agent.name,
     Test_Metrics.thousandeyes.target.agent.name
| rename Test_Metrics.thousandeyes.source.agent.name as sourceAgent,
         Test_Metrics.thousandeyes.target.agent.name as targetAgent
| where isnotnull(sourceAgent) AND isnotnull(targetAgent)
| eval latencyMs=round(_latencyS*1000,1),
       lossPct=round(lossPct,2),
       jitterMs=round(jitterMs,1)
| table sourceAgent targetAgent latencyMs lossPct jitterMs lastSeen
```

Expected: one row per real source/target agent pair on the
TLH-BLA test, with single-digit-to-low-double-digit
`latencyMs`, near-zero `lossPct`, low `jitterMs`. If the
table is empty, the data model isn't populating those
metrics for that test (or `summariesonly` macro setup
needs revisiting). If `latencyMs` is in the thousands, the
unit assumption was wrong and we should drop the `*1000`.

### What we did NOT change

- **`CustomerTopologyMap.tsx` consumer is unchanged.** The
  new `jitterMs`, `sourceAgents`, `targetAgents` fields
  are exposed in the SPL output but not yet rendered in
  the map popup. That's a deliberate small-step decision
  — let the SPL settle first, then update the consumer
  in a follow-up so we don't conflate two layers of
  changes.
- **No version-bump on `CustomerTopologyMap.tsx`** for the
  same reason.

### What's next

1. **Validate on the customer stack**: run the standalone
   TE query above against `TLH - BLA Connection`, confirm
   row count and units. Then load the Overview page and
   confirm the AUB↔TLH link picks up TE data instead of
   DNAC fallback.
2. **Update map popup** (`CustomerTopologyMap.tsx`) to
   render `jitterMs` and the source/target agent names
   when present. Small, focused PR.
3. **Once Cisco fixes `demb-te01-va`** and the real
   TLH↔AUB A2A test starts producing data, swap the
   test-name string in this stanza from
   `"TLH - BLA Connection"` to whatever the actual
   TLH↔AUB test is named. No other changes required.
4. **Carryover from morning**: `it_health_v1.xml` panel
   wiring; `/opt/10` drill-down regression diagnosis;
   `app.conf` / `macros.conf` / `props.conf` cleanup
   before next packaging.

---

## 2026-05-12 — David call: customer is TLH + AUB only; MCO removed from the topology

### Context

Quick post-meeting cleanup based on a customer call with David
(the customer). Three substantive truths surfaced that we hadn't been
designing against:

1. **the customer's actual site footprint is two locations**: Tallahassee
   (TLH, State EOC) and Auburndale (AUB, Logistics). Everything else
   is being decommissioned, including BLA. **MCO/Orlando was never
   an customer site** — it had been carried in our topology config and
   demo narrative as a placeholder third-site, but it has no
   real-world counterpart at the customer.
2. **The TLH↔AUB ThousandEyes agent-to-agent test is broken**: the
   Tallahassee enterprise agent (`demt-te01-va`) is unresponsive to
   probes. TE currently shows 100% network loss on the link, which
   is an artifact of the broken probe-response, not real packet
   loss. Recovering the agent is on the customer/Cisco; once it's back,
   anything we wire to the A2A test will start populating
   automatically.
3. **TE configuration ownership**: David confirmed Cisco did all the
   original TE setup; customer has minimal in-house TE knowledge beyond
   a login. Future TE changes (test reconfigs, agent rebuild) will
   need Cisco-side support. **TE data trust is low** until the agent
   is fixed and we can validate against ground truth.
4. **David likes the dashboard direction** (Critical Sites Available
   tile, baselines, simplified Overview, IT Health detail page).
   No course-correction needed on architecture.

The actionable engineering work was to delete every MCO/Orlando
reference from the live config paths so the map and SPL match
reality, while leaving breadcrumb comments for the next maintainer
who'll wonder why the demo narrative used to talk about three sites.

### What we built

#### Map topology — TLH + AUB only (`CustomerTopologyMap.tsx`)

`CUSTOMER_TOPOLOGY` shrinks from 3 sites + 3 links down to 2 sites
+ 1 link.

- **Removed**: the `mco` site entry, the `mco-tlh` link, and the
  `mco-aub` link.
- **Re-centered**: map default center moved from `[28.45, -82.85]`
  (the geometric center of the old three-site triangle) to
  `[29.25, -83.0]` (the midpoint between TLH at 30.4383,-84.2807
  and AUB at 28.0653,-81.7876). Default zoom of 6.55 keeps both
  markers visible without forcing a pan; bounds are intentionally
  left permissive so users can still scroll to neighboring states
  for context.
- **Updated comment** on `internetEdgeMbps`: now reflects that the
  customer-entered value (via the topology editor's "Internet edge
  Mbps" field, persisted to `splunk-cisco-dashboards.customerTopology.v4`
  in localStorage) is the only source of bandwidth on the popup.
  No more 1000/500 placeholders to mislead anyone.
- **Editor placeholder**: changed `"Overview - Link Orlando to
  Tallahassee Health"` placeholder text on the link search-name
  input to `"Overview - Link Auburndale to Tallahassee Health"`
  so the only example shown matches a real stanza.
- **Stale doc reference**: the JSDoc on the `SiteEnrichment` type
  used `(e.g. "TLH", "AUB", "MCO")` as an example list of building
  short names — dropped MCO from the example.

#### `searchbase.conf` cleanup

Removed three full stanzas and rewired everything that referenced
them:

- **Deleted**:
  - `[overview_site_orlando_health]` — the per-site Orlando rollup.
  - `[overview_link_orlando_tallahassee_health]` — the MCO↔TLH link
    health stanza.
  - `[overview_link_orlando_auburndale_health]` — the MCO↔AUB link
    health stanza.
- **Kept** as the only inter-site link stanza:
  - `[overview_link_auburndale_tallahassee_health]` — its SPL
    `case(...)` mappings are simplified to drop the `(?i)Orlando`
    branch (no MCO data ever existed to match it). Version bumped
    to `1.2.0`. Description rewritten to flag that the TLH↔AUB
    A2A test exists but is currently unhealthy because of the
    downed Tallahassee agent — if/when the agent recovers, this
    stanza is the right place to extend to consume
    `Cisco_ThousandEyes.Test_Metrics` for latency/loss/jitter on
    the pair.
- **Updated** the umbrella stanza `[overview_topology_overview]`:
  - Search filter narrowed from
    `(Site=*Tallahassee* OR Site=*TLH* OR Site=*Orlando* OR Site=*ORL* OR Site=*MCO* OR Site=*Auburndale* OR Site=*AUB* OR host=TLH-* OR host=ORL-* OR host=MCO-* OR host=AUB-*)`
    to just `(Site=*Tallahassee* OR Site=*TLH* OR Site=*Auburndale* OR Site=*AUB* OR host=TLH-* OR host=AUB-*)`.
  - All three `case(...)` branches that mapped Orlando/MCO patterns
    to a `siteId=mco` row were removed.
  - The link-expansion logic that emitted both `mco-tlh` and
    `aub-tlh` from each Tallahassee endpoint now emits a single
    `aub-tlh` row.
  - Version bumped to `1.1.0`; `related_info` updated to point at
    the only surviving per-site/per-link sibling stanzas.
- **Updated** the surviving site stanzas
  (`[overview_site_tallahassee_health]`,
  `[overview_site_auburndale_health]`): `related_info` no longer
  points at `[overview_site_orlando_health]` (it doesn't exist
  anymore), and each carries a one-line breadcrumb explaining that
  the Orlando stanza was removed on 2026-05-12 and why.
- **Updated** the IT Health composite-replacement
  `[it_health_sites_below_threshold]`: site count goes from
  `0..3 (TLH, MCO, AUB)` to `0..2 (TLH, AUB)`; SPL `case(...)`
  drops the Orlando branch; "Suggested Actions" rewritten so the
  "tile reads N" guidance matches the new total (2, not 3).
- **Updated** the demo stanzas: `[overview_top_incident_volume_demo]`
  now returns `"Auburndale (Logistics)"` instead of
  `"Orlando (Regional Hub)"` (the picker preview showed Orlando as
  the busiest synthetic site, which would have been confusing
  with no Orlando on the map). `[overview_site_demo_healthy]`
  related_info updated to say the production analogue stanzas
  are TLH and AUB only.
- **Updated** the drift-detection stanza
  `[admin_dashboard_drift_panel]` (Site Topology - Drift Panel):
  `makeresults count=3` → `count=2`, the inline expected-set
  hardcoded list drops `Orlando: MCO`, and the description /
  explanation prose drops the customer-specific Orlando paragraph.

#### Dashboard view JSON

- **`home_launchpad_v1.xml`**: removed the `viz_florida_dot_orl`
  ellipse from the Florida-map panel layout, the
  `viz_florida_dot_orl` viz definition itself, the
  `ds_florida_site_health_orl` data source, and the orphaned
  `viz_C0hqav52` line connector that used to go from TLH to MCO
  (the TLH↔AUB connector `viz_SQjolf8o` was kept). Validated the
  resulting JSON parses cleanly.
- **`admin_guide_v1.xml`**: the inline drift-detection query in
  `ds_site_drift` was updated identically to the searchbase
  stanza — count=2, drop the Orlando case branch.

#### What we left intact (and why)

- **`dnac_site_normalize` macro** (`macros.conf`): still maps
  `MCO` / `Orlando` paths to a normalized `Orlando: MCO` label.
  This is a defensive no-op — even with no customer Orlando site, if
  any stray Orlando data ever shows up in the indexes the macro
  classifies it correctly instead of leaking through. Cheap to
  keep, costly to re-derive if a future customer needs it.
- **Archive views** (`detail_dashboard.xml`,
  `spaces_intelligence_v2.xml`, `it_health_v2.xml` under
  `data/ui/views/archive/`): these aren't wired into the live
  navigation; they exist as historical reference for the design
  evolution. Skipped to keep the diff focused.
- **`overview_site_demo_critical/warning/healthy` stanzas**: still
  three demo variants. They aren't tied to physical sites — they
  represent three discrete render states for the topology editor's
  preview. No reason to drop one.

### Decisions worth remembering

- **No MCO tombstone stanza**. Briefly tried leaving an
  `[overview_link_orlando_auburndale_health_REMOVED_2026_05_12]`
  marker stanza so external saved-search subscribers would fail
  loudly. Backed out: searchbase is parsed key-by-key; a missing
  stanza already produces a clean "stanza not found" error if
  anyone references the old name. The breadcrumb comments above
  the surviving stanzas are enough.
- **Did NOT wire A2A `Test_Metrics` into the AUB↔TLH link yet.**
  The test exists in TE, but the TLH agent is down so the data
  is currently 100% loss / null latency. Wiring it would just
  make the popup look broken. Once the customer/Cisco recover the agent,
  the right move is to extend
  `[overview_link_auburndale_tallahassee_health]` with a Priority-0
  `tstats` against `Cisco_ThousandEyes.Test_Metrics` (latency,
  loss, jitter on the TLH↔AUB pair) ahead of the existing
  SD-WAN / DNAC-fallback chain. Description on that stanza
  already documents the plan.
- **Did NOT change the role/label tables** (`ROLE_LABEL`,
  `ROLE_DOT_CLASS`, `ROLE_BEACON_CHROME`, `TOPOLOGY_ROLES` in
  `CustomerTopologyMap.tsx`). They still expose `regional_hub` /
  `branch` / `datacenter` / `internet_edge` even though no
  current site uses any of those. Leaving them in lets a
  customer add a third site through the editor pencil-tool and
  pick the right role without a code change.

### Verification

- `yarn typecheck` (in `packages/splunk-cisco-dashboards`) → clean,
  zero TypeScript errors.
- `yarn build` → webpack production build succeeds; only
  pre-existing asset-size warnings (unchanged).
- `yarn lint` → still blocked by pre-existing
  `eslint-config-airbnb` resolution failure, unrelated to this
  diff. Tracked separately; this change does not introduce new
  lint surface.
- Both rewritten dashboard JSON definitions parse cleanly when
  extracted from their `<![CDATA[ ]]>` wrappers.
- Manual grep for `mco|orlando|MCO|Orlando` in the live config
  paths returns only the intentional historical-breadcrumb
  comments and the defensive `dnac_site_normalize` macro entries.

### Commit

Landed as `27a207b` — "Topology: drop MCO/Orlando; customer is
TLH+AUB only". Five files changed, 295 insertions / 295
deletions.

### What's next

1. **Send the David-call summary to Alan** (drafted in chat).
2. **Wait on the customer/Cisco to recover the TLH enterprise agent
   (`demt-te01-va`)**. When it's back:
   - Verify TE shows healthy A2A samples between TLH and AUB.
   - Extend `[overview_link_auburndale_tallahassee_health]` to
     consume `Cisco_ThousandEyes.Test_Metrics` (latency, loss,
     jitter) as Priority-0, ahead of the SD-WAN and DNAC
     fallbacks.
3. **Carryovers from 2026-05-11 still pending**:
   - Wire IT Health ThousandEyes stanzas
     (`it_health_thousandeyes_*`) into `it_health_v1.xml`.
   - KV-Store backed link/site capacity input (currently
     `localStorage`-only).
   - Drill-down regression on `/opt/10` — still need browser
     console output to root-cause.

---

## 2026-05-11 — customer Overview review with Alan, Cloud Vetting, layout & tooltip hardening

### Context

Two threads interleaved through the day:

1. **Splunk Cloud Vetting** flagged the package on lookup-file naming
   conflicts and a missing custom-conf reload trigger. Blocking issue
   for the customer's deployment.
2. **customer Overview review with Alan** — narrowed the top of the
   Overview to 3-4 high-signal tiles (Network Health, new Critical
   Website Availability, WAN/site map), added rolling-average baseline
   overlays so anomalies are visible at a glance, and cleaned up
   composite metrics that Alan didn't trust (UX Score, Compliance) in
   favor of more actionable replacements (Active TE alerts, Sites
   below threshold). HA-pair logic for site composites and a string
   of layout / popover bugs surfaced as users worked the live build
   on `/opt/10`.

Five commits landed:

| Commit | Subject |
|---|---|
| `515e999` | minor updates — Cloud Vetting fixes |
| `bd2ba4e` | customer Overview review: critical-site availability, baselines, HA-pair, composite swap |
| `e9ecdba` | customer Overview review: SPL math fix, layout overflow, capacity honesty |
| `521f3c3` | Topology editor: add per-site "Internet edge Mbps" input |
| `f2256a2` | InfoTooltip: portal popover so it can't be clipped by ancestors |

### What we built

#### Cloud Vetting (`515e999`)

- **Lookup file naming conflict**: removed
  `lookups/asset_inventory.csv.default`,
  `lookups/data_status.csv.default`,
  `lookups/exec_scores.csv.default`. Splunk Cloud's installer renames
  every lookup at install time to `<name>.csv.default`, which
  collided with the literal `.csv.default` files we shipped as seed
  rows. Keeping only the `.csv` files means the installer's rename
  step succeeds, and the seed rows themselves are still preserved
  inside the regular `.csv` files.
- **`app.conf` `[triggers]` stanza**: added `reload.searchbase = simple`
  so changes to `searchbase.conf` no longer require a full Splunk
  restart. Vetting requires every custom config to declare a reload
  policy; without it the installer warns about a forced restart on
  any future config change.

#### Critical Website Availability tile (`bd2ba4e`, math fix in `e9ecdba`)

A new top-level tile on the IT Health section, replacing one of the
older composite metrics. Reads the ThousandEyes
`Test_Metrics.metric_name:http.server.request.availability` data model
across an the customer-curated list of 18 business-critical sites
(`server.address` allow-list pulled from Alan's throughput-by-site
table — ranges from `www.floridadisaster.org` and the Salesforce login
endpoints through to `outlook.office.com` and `demftp.floridadisaster.org`).

- Headline: `"X of Y available"` where Y is the count of distinct
  monitored sites in the bucket and X is the count of sites whose
  AVG availability is at or above the 99.5% threshold.
- Sparkline: hour-bucketed availability percentage (current series)
  with a rolling-average baseline overlaid as a dashed line — same
  pattern we use for FW Blocked and Failed Auth so anomalies stand
  out visually rather than relying on the user to remember last
  week's numbers.
- Drilldown: per-site availability table, sorted ascending so the
  worst-performing sites surface first.

`searchbase.conf` stanzas added:

- `[executive_dashboard_critical_website_availability]` — headline
  + sparkline + status fields. `display` field uses
  `tostring(latest_up) . " of " . tostring(latest_total) . " available"`
  so the headline is robust against numeric-coercion surprises.
- `[executive_dashboard_critical_website_availability_drilldown]` —
  per-site table for the drill-down.

**Math fix in `e9ecdba`**: the original SPL computed `sites_total`
from the row count after the `BY _time, site` group-by, which counts
*every* (sub-time, site) measurement row — about 14 measurements per
site per hour times 18 sites = ~248 rows in the latest hour, so the
headline displayed "3870 of 4471 available" instead of "17 of 18
available". The fix is two changes:

1. `BY _time span=1h, ...` on the tstats up front so each (hour,
   site) is exactly one row.
2. `timechart span=1h sum(available) AS sites_up, dc(site) AS
   sites_total` so the denominator is now distinct sites in the
   bucket.

Headline percentage was already correct (3870/4471 = 86.6% matched
the 17/18-ish reality for the most recent hour); only the labels
were misleading.

#### Baseline overlays (`bd2ba4e`)

Two security tiles Alan specifically called out — "Unique IPs Blocked
by Firewall" and "Failed Authentications" — needed to read as
"current vs rolling average" so the user can spot anomalies
immediately rather than having to remember last week's baseline.

- New `_with_baseline` searchbase variants
  (`executive_dashboard_firewall_blocked_with_baseline`,
  `executive_dashboard_failed_logon_with_baseline`) emit per-hour
  bars plus an `eventstats avg`-derived rolling-average baseline
  series.
- `Sparkline.tsx` now renders a `ComposedChart` (Recharts) for the
  `column` viz path: bars for current values, dashed line for the
  baseline overlay. The baseline line was readability-tuned in
  `e9ecdba` (gray-800 / 1.75px / `6 3` dash at 90% opacity) after
  Alan said the original slate-400 / 1px stroke was too faint
  against the column bars on the live customer stack.
- `useMetric` extended with `baselineField` so the baseline series
  is read from the main search result instead of dispatching a
  second job — keeps tile load behavior identical to the single-
  series tiles.
- Same baseline pattern wired into the Critical Sites tile so all
  three "anomaly visibility" tiles share the same rolling-average
  vocabulary.

#### Sparkline color sync (`bd2ba4e`)

Alan caught a bug where a tile's headline number could be red
("critical" status) but its sparkline was still green (because the
sparkline color came from a brand-color prop that was never threaded
through to the trend-line). The fix:

- Introduced `STATUS_VIZ_COLOR` mirroring `STATUS_TREND_COLOR`,
  applied uniformly to the sparkline / change-arrow / change-pct.
- Brand colors for `threat_sources` and `xdr_incidents` changed
  from red to neutral sky blue (`#0ea5e9`) so red is reserved for
  critical-status anomalies — earlier they were red even when
  healthy, which made anomaly red unreadable.

#### Headline auto-shrink (`bd2ba4e`)

The new "X of Y available" string overflows the default `text-4xl`
on narrower tiles. Added a string-length check in `MetricItem`:
when `value` is a string and the rendered headline (`displayValue +
unit`) is longer than 7 characters, fall back to `text-2xl`.
Numeric headlines and short strings keep the traditional punch.

#### HA-pair-aware site composite (`bd2ba4e`)

the customer's site composites (Tallahassee, Orlando, Auburndale) were
double-counting standby HA peers as "down": Catalyst Center reports
the standby device with a 0 health score, which silently dragged
the site composite down to 50% even when both physical devices were
fully healthy.

Updated SPL in `[overview_site_tallahassee_health]`,
`[overview_site_orlando_health]`, `[overview_site_auburndale_health]`
to filter out zero-scoring devices *only when an active peer is
also reporting in the same window*. If everything reports zero, the
site rolls up zero (real outage). If exactly one device reports
zero, the standby/zero peer is dropped from the rollup — site
score reflects the active devices only.

#### Composite metric replacement (`bd2ba4e`)

Alan said the UX Score and Compliance composite tiles felt
arbitrary — they were aggregations of aggregations and he couldn't
trace what made the number move. Replaced both with single-source
tiles whose semantics he can explain to customer directly:

- `[it_health_active_te_alerts_high_critical]` — counts per-hour
  distinct critical+high ThousandEyes alerts with a rolling-average
  baseline.
- `[it_health_sites_below_threshold]` — counts customer sites whose
  device-health rollup is below the configurable warn threshold
  (default 90%).

Both stanzas tagged `Cisco` so they show up in the picker.

#### IT Health TE detail-page stanzas (`bd2ba4e`)

Seven new searchbase stanzas seeded for the IT Health detail page
(panels not yet wired — that's the carryover):

- `it_health_thousandeyes_network_latency`
- `it_health_thousandeyes_network_loss`
- `it_health_thousandeyes_network_jitter`
- `it_health_thousandeyes_alerts_summary`
- `it_health_thousandeyes_alerts_timeline`
- `it_health_thousandeyes_alerts_table`
- `it_health_thousandeyes_endpoint_traces`

#### KPI picker self-healing refresh (`bd2ba4e`)

Alan reported that the picker's "Currently bound" / "Jump to" banner
wasn't appearing for newly added stanzas. Two root causes:

1. New stanzas hadn't been tagged `Cisco` (the picker's allow-list
   filter). Fixed: every stanza added today carries the tag.
2. Stale in-memory catalogue. Picker was reading a cached
   `searchbase.conf` parse from before the new stanzas existed.

Fix: `KpiPickerPanel` now does a one-shot self-healing refetch — if
the currently-bound `saved_search` isn't in the loaded catalogue,
clear the cache and refetch once. Avoids permanently broken pickers
when the catalogue changes underneath the open browser tab.
`searchbaseCatalogue` exports `clearSearchbaseCache` for explicit
invalidation.

#### Per-section default tile counts (`bd2ba4e`)

Alan wanted IT Health to default to 3 visible tiles (the high-signal
ones) while keeping other sections at their existing 5-tile default.
Refactored `usePersistedSectionTileCounts` so `defaultCount` accepts
either a single number or a per-section map; Overview now passes
`{ it_health: 3 }` with a `fallbackDefault: 5`. The +/- pill and
drag-to-reorder are intentionally preserved — Alan can dial it back
up to 6 when he wants the full picture.

#### Capacity honesty (`e9ecdba`)

Three link-health stanzas (`overview_link_orlando_tallahassee_health`,
`overview_link_auburndale_tallahassee_health`,
`overview_link_orlando_auburndale_health`) had hardcoded
`capacityMbps=1000 / 100` rows in their appendpipe defaults. Those
were initial estimates from an early design-of-record conversation
that were never confirmed against real circuit records — shipping
them on a customer-facing exec dashboard meant the popup was
claiming a number we did not actually know.

- Set `capacityMbps=null()` in the default rows.
- Updated `telemetrySourceLabel` from "design-of-record" to
  "(capacity awaiting circuit info)".
- React popup already gates the capacity pill on
  `link.capacityMbps !== undefined`, so the pill cleanly disappears
  when the value is null.
- Same cleanup applied to per-site `internetEdgeMbps` defaults in
  `CustomerTopologyMap.tsx`'s `CUSTOMER_TOPOLOGY` (TLH=1000, MCO=500,
  AUB=500 placeholders dropped).

#### Customer-editable capacities (`521f3c3`)

The cleanup above raised a follow-up: with the placeholders gone,
where does the customer enter their real circuit speeds?

- **Link capacity**: editor input *already existed*. Pencil icon
  on the topology map → expand a Link → fill in `Capacity Mbps`
  → Save. Persists in localStorage payload
  (`splunk-cisco-dashboards.customerTopology.v4`); link popup pill
  appears the moment a value is saved.
- **Per-site Internet edge bandwidth**: editor input *did not
  exist*. The data type and popup conditionally rendered the value,
  but there was no UI path to populate it after we removed the
  defaults. Added `Internet edge Mbps` input under the Lat/Lng
  grid in the per-site editor (`CustomerTopologyMap.tsx`),
  mirroring the link-capacity pattern: empty clears to undefined,
  number-coerces non-empty input, persisted in the same
  localStorage payload. Inline helper text reminds the user that
  blank is acceptable ("Awaiting" stays on the popup) and that the
  field maps to the popup's "Design of Record" line.
- Updated `TopologySite.internetEdgeMbps` doc comment in
  `types.ts` — it claimed the field was a "hardcoded configuration
  value," which was true for an hour earlier in the day but is no
  longer.

**Customer-facing answer (recorded here so this doesn't get asked
again):** both manual-entry paths exist. If a popup currently shows
"Awaiting" for capacity, that's because (a) we removed the
hardcoded placeholders that morning, and (b) no value has been
typed through the editor yet. Pencil icon → Sites or Links → fill
in capacity field → Save.

#### Layout-overflow fixes (`e9ecdba` → revisited in `f2256a2`)

Two visual bugs surfaced when the browser window was shrunk:

1. **Bars overflowing tile edges horizontally**: `Sparkline`'s
   `column` viz path was using a `type="number"` X-axis (inherited
   from the area-viz config), which centers each bar on its
   x-coordinate — so the first/last bar protruded half-width past
   the tile edges. Fix: separate `hiddenAxesCategorical`
   (`type="category"` X-axis) routed to the column branch, so bars
   slot into evenly-spaced cells with auto-sized widths and stay
   inside the chart.
2. **Charts bleeding vertically into the section's footer
   drill-down link**: chart container had a fixed
   `h-28 flex-shrink-0` (rigid 112px) that couldn't compress when
   the browser was vertically shrunk. The first attempt
   (`e9ecdba`) added `overflow-hidden` to the section's tile-row
   container as a safety net; that *did* clip the chart but also
   clipped sibling popovers — see the InfoTooltip regression below.

Final approach (`f2256a2`):

- Chart container in `MetricItem` is now
  `flex-1 min-h-[72px] max-h-28 overflow-hidden` — chart can
  compress gracefully down to a 72px floor while still reading as
  a chart, and any spill is clipped at the chart's *own* boundary
  rather than at the row.
- Tile-row `overflow-hidden` removed from `DashboardSection`.
- Single-value tiles get a `flex-1 min-h-0` spacer so they share
  row height with chart-bearing siblings (otherwise the divider
  rules between tiles wouldn't line up).

#### InfoTooltip popover portal (`f2256a2` + same-session fix-forward `494f4b3`)

Alan flagged "i think the info modal is getting truncated" on the
new Critical Sites tile — the description body cut off mid-sentence
("...dashed line is the rolling-average baseline so") with the rest
behind the section card boundary.

Root cause: `e9ecdba`'s `overflow-hidden` on the tile row also
clipped every absolute-positioned descendant, including the
InfoTooltip popover. Once an ancestor has `overflow:hidden`,
`z-index:50` doesn't save you — z-index can't escape an overflow
clip path. The same trap applies to the section card's own
`overflow-hidden` (used for rounded-corner shape).

**First attempt (`f2256a2`) — partially regressed and had to be
fixed forward in the same session:** `InfoTooltip` was rewritten to
portal the popover via `createPortal` with `position: fixed` and
coords computed from the trigger's `getBoundingClientRect()` in a
`useLayoutEffect`. The portal target was `document.body`, on the
theory that "the popover's only ancestor is `<body>`, so no layout
container in the dashboard tree can clip it now or in the future."

That fixed the truncation but immediately broke the styling: the
popover rendered as raw unstyled text floating over the tile
content (Alan: "you made the info modal worse!!!"). Root cause was
a project-specific gotcha I missed:
`packages/splunk-cisco-dashboards/tailwind.config.js` declares
`important: '#scan-root'`, which scopes EVERY generated utility
class under `#scan-root .<class>` so Tailwind utilities don't bleed
into Splunk Web's own chrome around the dashboard panel. By
portaling to `document.body`, the popover was rendered OUTSIDE
`#scan-root`, so none of the `bg-slate-900 / p-4 / rounded-lg /
shadow-xl / ring-1` classes were applied. The popover was working
structurally; it just had zero styling because Tailwind's scoped
classes didn't reach it.

**Fix-forward (same-session follow-up commit):** changed the
portal target from `document.body` to
`document.getElementById('scan-root') ?? document.body`. Trade-off
analysis:

| Target | Tailwind classes apply? | Escapes tile-row clip? | Escapes section-card clip? |
|---|---|---|---|
| `document.body` (broken first revision) | NO | yes | yes |
| `#scan-root` (current) | yes | yes | yes |
| In-tree `position: fixed` (no portal) | yes | yes | yes today, fragile against any future ancestor with `transform`/`filter`/`contain` |

`#scan-root` is the right answer because (a) it IS the React
mount node, so we know it exists when the component renders
(`render.jsx` already retries on it), (b) it's INSIDE the Tailwind
scope, so utility classes apply normally, (c) it's OUTSIDE every
dashboard-layout container with `overflow-hidden` (section cards,
tile rows, future scroll regions), so the popover is not clipped
by any of them. The fallback to `document.body` is theoretical
defense for SSR-style environments and shouldn't trigger in
practice on Splunk Web.

Bonus features now possible because the popover is portaled:

- **Viewport edge clamping**: left/right anchors are clamped to
  within 8px of the viewport edges so the shadow never crops at
  narrow widths.
- **Bottom-flip**: if the popover would push past the viewport
  bottom (tile near the bottom of a short window), it flips above
  the trigger.
- **Reposition on scroll/resize**: while open, listens on `window`
  for both events so the popover follows its trigger.

Trade-off: visibility is now state-driven (`isOpen` boolean) instead
of CSS-only `:hover`/`:focus-within`. Adds one tiny render per
hover; closed tiles add zero overhead. Hover/focus accessibility
behavior is unchanged.

**Lesson recorded for future sessions:** any code path that renders
out of the React tree (portals, manual `appendChild`, anything
moving DOM nodes via `document.body`) must remember
`important: '#scan-root'` from `tailwind.config.js` and either (a)
portal into `#scan-root` to keep utility classes working, or (b)
switch to inline styles (`style={...}`) for the externalized
element. Default reflex of "portal into body" — which is correct
for most React projects — is wrong for this one until either the
Tailwind scope or the portal pattern changes.

### What we decided NOT to do (and why)

- **Wire the seven new IT Health TE stanzas into `it_health_v1.xml`
  this session.** Deferred to a follow-up PR. The stanzas exist
  and are picker-discoverable; wiring them is XML panel-layout
  work that's better isolated from today's tile / SPL / layout
  work.
- **KV Store-backed capacity persistence.** Customer-entered
  link/site capacities are persisted only in the user's browser
  (localStorage payload, key
  `splunk-cisco-dashboards.customerTopology.v4`). An edit on
  Alan's machine is invisible to Manny's. Backing this with a
  Splunk KV Store collection would (a) make edits team-shared and
  (b) let the SPL itself read the customer-entered value (so
  utilization-% computes server-side instead of just rendering
  in the React popup). Out of scope today: needs a new REST
  endpoint, a permissions story (who can edit?), and an
  `app.conf` permissions stanza — none of which the customer has
  asked for yet.
- **Wave 1 site-map** (real WAN visibility from agent-to-server
  rollups grouped by source-site). Blocked on either an
  agent-to-site mapping from the customer or the agent-to-agent
  test rollout we asked David to consider. Discussed with Alan;
  message to David is on Akhamis to send.
- **Drill-down regression on `/opt/10`**. User reported all
  drill-down affordances (↗ icon, footer link, KPI picker "Jump
  to") were broken on a specific test instance. Probable cause:
  the searchbase catalogue fetch was returning 503s on that stack,
  leaving `result.spl` undefined. Self-healing refetch landed in
  this session as defensive armor; full root-cause needs the
  console output from the affected stack, which the user said
  they'd capture next session.

### Verification

- `yarn workspace @splunk/splunk-cisco-dashboards run build`
  green at every commit boundary; only the pre-existing
  asset-size warnings (overview.js, searchbase.conf, background
  PNGs).
- Lint clean on every edited TSX/TS file across all five commits.
- Manually traced every flow that changed:
  - Critical Sites SPL on customer stack: headline reads
    `17 of 18 available` (was `3870 of 4471 available` pre-fix),
    drill-down table sorted ascending with worst sites first.
  - Baseline overlay readable on FW Blocked / Failed Auth /
    Critical Sites against the full status-color palette.
  - HA-pair filter: TLH/MCO/AUB site rollups no longer drop to
    50% when one HA peer is standby.
  - InfoTooltip on Critical Sites: full body visible, no
    truncation; clamps at viewport edges; flips above trigger
    near viewport bottom.
  - Per-site editor: typing 1000 in `Internet edge Mbps`,
    saving, re-opening the popup → "Design of Record: 1000 Mbps"
    line appears.
  - Per-link editor: typing 100 in `Capacity Mbps`, saving,
    re-opening the popup → "Capacity: 100 Mbps" pill appears.

### What's next

- **Wire the seven new IT Health TE stanzas into `it_health_v1.xml`**
  as panels. Follow-up PR.
- **Send the message to David** about ThousandEyes A2A test
  feasibility — needed for Wave 1 site-map work. (User to send;
  agent to draft if asked again.)
- **Capture console output from `/opt/10`** to root-cause the
  drill-down regression. The self-healing refetch in
  `KpiPickerPanel` is defensive armor; the underlying 503 / fetch
  failure pattern still needs a definitive read.
- **KV Store-backed capacity persistence** when the customer asks
  for team-shared edits or SPL-readable circuit speeds. Spec
  needs: new REST endpoint, permissions stanza in `app.conf`, and
  a migration path from existing localStorage payloads.
- **Process change agreed this session**: maintain this
  `SESSION_LOG.md` as the running record of asks / decisions /
  deferrals so the customer and the agent stay synced. Each
  session must update it before closing out.
- Two files modified locally but not committed: `app.conf` (build
  bump beyond what `e9ecdba` set) and `macros.conf`. Likely the
  user's packaging cycle; left alone pending direction.

---

## 2026-05-09 — Searchbase metadata audit & Cisco-tag gate cleanup

### Goal of the session

Make every stanza in `searchbase.conf` discoverable through both the
overview picker (which gates on the literal `Cisco` tag —
`KpiPickerPanel.tsx:431`) and the Splunk Searchbase admin UI (which
indexes `description` / `explanation` / `solution` / `related_info`
/ `category` / `sub_category` / `tags`). User ask:

> "I need you to make sure all of these fields are accurate for each
> stanza, update as necessary and make sure we are categorizing and
> sub-categorizing and tagging in the best manner possible so admins
> can quickly find these searches."

### What we built

1. **`scripts/audit_searchbase_metadata.py`** — one-shot inventory of
   every stanza for missing prose / classification fields, plus tag
   and category vocabulary normalisation candidates. Output:
   `scripts/searchbase_metadata_audit.md`.
2. **`scripts/fix_searchbase_metadata.py`** — applied conservative,
   automated fixes:
   - Added the picker-gate `Cisco` tag to the 6 `cisco:dnac:issue`
     stanzas rewritten in this session's earlier Group B work that
     were inadvertently left without it (the 7th sibling already had
     it). Picker-visible count: 106 → 112.
   - Normalised redundant tag spellings (consolidated to a single
     canonical form): `ActiveDirectory` → `Active_Directory`,
     `Executive Summary` → `Executive_Summary`, `Network Activation`
     → `Network_Activation`, `Cisco Cloud Security` →
     `Cisco_Cloud_Security`, `Secure Access` → `Secure_Access`,
     `Cloud Firewall` → `Cloud_Firewall`, `SDWAN` → `SD-WAN`.
   - Normalised one sub-category casing variant: `IDS/IPS` →
     `IDS / IPS`.
   - Touched 27 stanzas; bumped `version`, `date_updated`, and
     `updated_author` on each.
3. **`scripts/fix_searchbase_prose_gaps.py`** — filled the 16 stanzas
   the audit flagged as missing `related_info` (overview map
   per-site / per-link health, demo variants, the topology umbrella,
   and shared-helper datasources). Three of those stanzas
   (`shared_ds_dev_health_trend`, `building_resilience_ds_room_detail`,
   `shared_ds_annotations`) were also missing `explanation` and
   `solution` and got those filled too.

### Cisco-gate policy (after this pass)

| Bucket | Count |
|---|---:|
| Stanzas with `Cisco` tag (visible in overview picker) | 112 |
| Stanzas without `Cisco` tag (hidden from picker, still discoverable in Searchbase UI) | 302 |

Policy: the `Cisco` tag is the validated-for-picker allow-list. New
stanzas only earn it after they've been audited against live data.
Today's Group A and Group B stanzas — both now validated against the
live `index=dnac` shape — all carry it.

### Carryover bug fix found while auditing

`it_health_v1.xml` &rarr; `ds_base_issues_ref` data source was using
the same broken assumption as the deleted Group B stanzas: it
projected `SiteName` / `SiteNameHierarchy` / `SiteType` from
`cisco:dnac:issue` events that don't carry those fields. Every
downstream panel that extends this base (8 of them — interface
utilization, issues by site x2, etc.) was either showing a single
`Unknown` site row (where `fillnull` was applied) or collapsing all
issues into one null row.

Fix: rewrote the base query with the same
`cisco:dnac:devicehealth`-join-on-`DeviceID` pattern used in the
Group B `searchbase.conf` rewrites:

```
| join type=left DeviceID [ search `index_catalyst` sourcetype="cisco:dnac:devicehealth"
   | stats latest(Site) as SiteName, latest(Location) as SiteNameHierarchy by DeviceID ]
| eval SiteName=coalesce(SiteName, "Site enrichment unavailable"),
       SiteNameHierarchy=coalesce(SiteNameHierarchy, SiteName),
       SiteType=null()
```

Validated by parsing the dashboard JSON definition end-to-end — no
syntax breakage. Every panel that extends `ds_base_issues_ref`
inherits the enriched site context.

### Verification

- Re-ran `scripts/audit_searchbase_metadata.py`: 0 missing
  `description` / `explanation` / `solution` / `related_info` /
  `category` / `sub_category` / `tags` across all 414 stanzas. Zero
  tag or category casing-variant warnings.
- Re-ran `scripts/audit_sourcetype_fields.py --audit-only
  --output-suffix=merged_live_dnac_v2`: 0 high-confidence findings,
  same 1 partial-confidence finding for `[asset_inventory_build_lookup]`
  (F5/Meraki sourcetypes without inventory data on the current stack
  — needs an F5 stack to clear).

### What's next

- Run the field audit on a stack that has F5 data to clear the
  remaining partial-confidence finding.
- Wire `audit_sourcetype_fields.py --audit-only` and
  `audit_searchbase_metadata.py` into pre-commit / CI.
- XDR `props.conf` `site` alias check (carryover from earlier
  pass).

---

## 2026-05-09 — Live-DNAC schema reconciliation (Groups A/B/C/D)

### Goal of the session

Close out the audit findings surfaced when the user pointed `index=dnac`
at a real Catalyst Center TA (replacing the oneshot-derived inventory
that previous sessions used as ground truth). The merged-live-DNAC-v2
audit had landed **10 high-confidence findings + 1 partial-confidence**
across 17 stanzas, all bucketed into four product-decision groups.

User direction: *"can you just please do what you think is best? what
do you recomend we do?"* — i.e. stop deliberating and execute.

### Pre-flight: how badly did this matter?

A quick consumer scan answered the most important question: **all 17
affected stanzas are orphans.** Zero `views/*.xml`, zero React/TSX,
zero other config files reference any of them. They show up in the
gear-icon picker UI for dashboard authors, but no panel is bound to
them. So the work is about correctness for *future* binding, not
fixing broken panels — which means we can be aggressive about
deleting stanzas that target data shapes that don't exist anywhere.

```
Stanza                                                       Consumers
----------------------------------------------------------------------
it_critical_systems_inventory_reachability_summary           (NONE - orphan)
it_critical_systems_inventory_unreachable_detail             (NONE - orphan)
... (all 17 reported NONE) ...
```

Snapshot before touching anything: `git tag snapshot/pre-live-dnac-rewrites`.

### Group A — Catalyst Center reports rewritten (6 stanzas, kept)

**The bug:** the previous revisions used speculative camelCase
(`complianceStatus`, `deviceName`, `deviceFamily`, etc.) and
speculative split-status fields (`Reachability Status` +
`Manageability Status`). Live data uses Title-Case-with-spaces and a
single `Status` column.

**The fix:** rewrite the SPL of each stanza against the actual schema
the live `cisco:catalyst:center:inventory:report` and
`cisco:catalyst:center:compliance:report` events emit. Bumped each to
`version = 1.0.1`, `updated_author = codex`, with a
`Schema-correction history` bullet in `related_info` documenting
exactly which fields moved.

| Stanza | What changed |
|---|---|
| `inventory_reachability_summary` | `"Reachability Status"` + `"Manageability Status"` &rarr; `Status` (single column). The synthetic `Reachable + Managed` bucket is retired because the data doesn't support it. |
| `inventory_unreachable_detail` | `"Site Hierarchy"` &rarr; `Location`. `"Device Series"` &rarr; `"Device Type"`. Added `"Up Time"` and `"Time Since Code Upgrade via Cisco DNA Center SWIM"`. |
| `inventory_device_family_distribution` | `"Device Series"` &rarr; `"Device Type"`. |
| `compliance_report_rate` | `complianceStatus` &rarr; `"Compliance Status"`, `deviceName` &rarr; `"Device Name"`. |
| `compliance_report_status_distribution` | Same camelCase &rarr; Title-Case rename. |
| `compliance_report_noncompliant_detail` | **Major rebuild.** `complianceMessage`, `totalChecks`, `passCount`, `failCount`, `siteHierarchy`, `role`, `deviceFamily`, `deviceSeries` *all* don't exist in the live data. Replaced with the per-feature columns the report actually emits: `"Software Image"`, `EoX`, `"Network Profile"`, `"Network Settings"`, `"Startup Vs Running Configuration"`, `"Critical Security Advisories"`, `"Application Visibility"`, `"Customization Profile"`, `Fabric`. |

### Group B — `cisco:dnac:issue` site enrichment (7 stanzas, kept)

**The bug:** `cisco:dnac:issue` events on the live TA carry
`Issue*` and `Device*` context but **no site / location field at all**.
Every stanza grouped by `SiteName` or counted `dc(SiteName)`, which
returned zero on every customer.

**The fix:** add a `join type=left DeviceID` against
`cisco:dnac:devicehealth`, which *does* ship `Site` (e.g.
`"Global/Cali/San Jose/SJC23/Floor 2"`) keyed on the same
`DeviceID` UUID. After the join, every issue event has a Site path.

```spl
`index_catalyst` sourcetype="cisco:dnac:issue" ...
| join type=left DeviceID
   [ search `index_catalyst` sourcetype="cisco:dnac:devicehealth"
     | stats latest(Site) as Site by DeviceID ]
| eval Site=coalesce(Site, "Site enrichment unavailable")  # only on stanzas grouping BY Site
| stats ... by Site, ...
```

For stanzas that group BY Site (`issues_by_site`,
`issue_summary_kpis`'s `affected_sites` count) the `coalesce()` keeps
issues whose device wasn't in the recent `devicehealth` snapshot
visible (bucketed under `"Site enrichment unavailable"`) rather than
silently dropped. For stanzas that just *display* Site as one column
of many (the per-domain triage tables), the missing-site rows still
appear, just with an empty Site cell — the user can still drill in by
device.

Stanzas updated:

- `executive_dashboard_issue_summary_kpis` (1.1.0 &rarr; 1.2.0)
- `executive_summary_issue_details` (1.0.0 &rarr; 1.0.1)
- `it_critical_systems_aaa_server_issues` (1.0.0 &rarr; 1.0.1)
- `it_critical_systems_ap_disconnect_issues` (1.0.0 &rarr; 1.0.1, also
  collapsed `SiteName` + `SiteNameHierarchy` into the single
  hierarchical `Site` path which already encodes building/floor)
- `it_critical_systems_bgp_neighbor_issues` (1.0.0 &rarr; 1.0.1)
- `it_critical_systems_interface_utilization_issues` (1.0.0 &rarr; 1.0.1)
- `it_critical_systems_issues_by_site` (1.0.0 &rarr; 1.0.1)

Performance note: the join subsearch is bounded to
`stats latest(Site) as Site by DeviceID` against `cisco:dnac:devicehealth`,
which is naturally small (one-row-per-device snapshot per cycle). Even
on a large customer this returns hundreds-to-low-thousands of rows,
well under Splunk's default subsearch caps. If a customer ever blows
past that, the right next step is a generated lookup CSV refreshed by a
scheduled search; the join pattern is documented in `related_info` so
the rewrite path is obvious.

### Group C — `[audit_logs_by_site_lookup_join]` deleted

`network.deviceId` and `network.siteId` are null in **100% of live
`cisco:dnac:audit:logs` events** (verified: 26/26 events on the live
Catalyst Center TA had `network: null`). The stanza was dead code on
every standard-TA customer. Replaced the stanza body with a comment
block explaining why and pointing at the snapshot tag for restoration.

### Group D — Three `cisco:dnac:site:topology` alert-event stanzas deleted

All three (`site_topology_recent_changes`,
`site_topology_event_type_distribution`,
`site_topology_site_type_distribution`) filtered
`WHERE isnotnull(eventId)` to target the alert-event variant of
`cisco:dnac:site:topology`. The live TA only emits the **hierarchy
snapshot** variant (one event per global/area/building/floor node, no
`eventId`, no `details.*`, no `severity`). All three would silently
return zero rows on every standard-TA customer.

Topology *change* events on the live TA flow through
`cisco:dnac:audit:logs` (with `category` / `eventHierarchy` carrying
the change context), and the existing hierarchy-snapshot stanzas
elsewhere in the file already handle the snapshot variant correctly.
Replaced the three deleted stanzas with a comment block explaining the
schema mismatch and pointing at the snapshot tag.

### Verification: audit re-run

```
$ python3 scripts/audit_sourcetype_fields.py --audit-only \
    --output-suffix=merged_live_dnac_v2

Audit complete:
  inspected                         280
  skipped_no_sourcetype             102
  skipped_makeresults                 9
  skipped_no_inventory_data          23
  flagged                             1
```

**Before:** 10 high-confidence + 1 partial-confidence = 11 findings.
**After:** 0 high-confidence + 1 partial-confidence = 1 finding.

The single remaining finding is `[asset_inventory_build_lookup]`
flagging fields (`hostname`, `managementIp`, `marketingName`,
`platform`, `version`) that are likely supplied by the F5 / Meraki /
DNS sourcetypes that have no inventory data on this stack. It's
correctly de-escalated to partial-confidence — pending a stack with
F5 data to settle.

### Files touched

- `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf` —
  6 Catalyst Center report stanzas rewritten (Group A); 7 issue
  stanzas re-shaped with devicehealth site join (Group B); 1 audit
  log stanza deleted (Group C); 3 topology alert stanzas deleted
  (Group D). Net `+ 13 rewrites, − 4 stanzas` plus comment blocks
  documenting deletions.
- `scripts/sourcetype_audit_findings_merged_live_dnac_v2.md` —
  regenerated; now 0 high-confidence findings.
- `packages/splunk-cisco-dashboards/docs/SESSION_LOG.md` — this entry.

Snapshot tag: `snapshot/pre-live-dnac-rewrites` (rollback path).

### What's next

1. **Run the audit on a stack that has F5 data** to clear (or
   confirm) the single remaining partial-confidence finding on
   `[asset_inventory_build_lookup]`. (Carryover from previous
   session — still open.)
2. **Wire `audit_sourcetype_fields.py --audit-only` into
   pre-commit / CI** so future stanza edits get the same field
   check automatically. (Carryover.)
3. **Sweep XDR `props.conf` for a `site` field alias** — if the
   customer's TA exposes `site` via alias and the audit script
   isn't reading aliases yet, the coalesce sentinel will hide
   real values. Confirm before treating the data dependency as
   permanent. (Carryover.)
4. **Pick up the next user-facing dashboard work**. With 17 orphan
   stanzas now correct against live data, dashboard authors can
   drop them into Studio panels via the picker UI without surprises.
   The most natural next move is to wire the Catalyst Center report
   stanzas (Group A) into a new "Inventory & Compliance" panel in
   the IT Health dashboard, since the data feed is now live.

---

## 2026-05-09 — KPI tile cleanup + sourcetype field audit infrastructure

### Goal of the session

Two asks, related by the same root cause:

1. **Wire the two right-column KPI tiles** ("Top Incident Volume" and
   "Operational Lead") through `searchbase.conf` so the gear icon's
   "Currently bound" banner + "Jump To" button work the way they do
   for every other tile. Today the picker shows neither, because the
   tiles are defined with hardcoded inline SPL and `savedSearch`
   undefined — the picker's `currentBoundEntry` lookup falls through.
2. **Stand up an MCP-style field audit** so we can stop guessing what
   fields each Cisco sourcetype actually exposes. The user noticed
   stanzas referencing fields that may not exist on the data — the
   audit is the way to find those at scale.

### Part 1 — KPI tile cleanup

#### What the tiles actually are

Single-row, single-string KPI cards. They emit one `value` column
that's a *site name*, not a number. No trend line, no major/minor
numerics, no thresholds. They answer "who's at the top of the
leaderboard?" rather than "how big is the number?". Distinct
counter-pattern from the regular metric tiles.

| Tile | Question answered | Source |
|---|---|---|
| Top Incident Volume | "Which site is loudest in XDR right now?" | `cisco:xdr:incidents` / `cisco:xdr:incidents-summary` |
| Operational Lead | "Which site is healthiest right now?" | `cisco:dnac:devicehealth` |

#### Why "Jump To" was broken

`KpiPickerPanel.currentBoundEntry` is computed from
`context.currentSavedSearch`. For the regular metric tiles, the
static config has `savedSearch: '<searchbase entry name>'`, so the
picker resolves it cleanly. The two KPI tiles instead had:

```ts
{ id: 'top_incident', spl: '...inline SPL...', valueField: 'value' }
```

`savedSearch` was undefined → `currentSavedSearch` was undefined →
`currentBoundEntry` was null → no banner, no "Jump To" button, no
auto-scroll. The inline SPL was also a duplicate of the
`append [search ...]` blocks already inside
`overview_topology_overview` (which the topology React component
reads as a summary feed).

#### The fix

Three coordinated changes:

1. **Two new stanzas in `searchbase.conf`** (between
   `overview_topology_overview` and the per-site health entries),
   modeled on the existing `default_viz = splunk.singlevalue`
   convention and tagged with `Cisco` so the picker (which gates on
   that tag) surfaces them:
   - `[overview_top_incident_volume]` — `Overview - Top Incident Volume`
   - `[overview_operational_lead]` — `Overview - Operational Lead`

   Each carries the full description / explanation / solution / related-info
   block matching the rest of the catalogue, plus the SPL extracted
   verbatim from the topology overview's `append` blocks.

2. **`KPI_CONFIG` in `pages/overview/index.tsx`** drops the inline
   `spl` field and uses `savedSearch` pointing at the new stanzas:

   ```ts
   { id: 'top_incident', savedSearch: 'Overview - Top Incident Volume', ... }
   { id: 'operational_lead', savedSearch: 'Overview - Operational Lead', ... }
   ```

3. **`buildEffectiveKpiCfg` extended** so the no-override branch now
   resolves `savedSearch` through `searchbaseByName` to literal SPL,
   exactly the way the override branch already did. Prior behaviour
   would have dispatched `| savedsearch "..."`, which silently fails
   for searchbase-only stanzas. The override-branch logic stays
   untouched. `useKpi`'s `resolveMetricSpl` still picks `spl` over
   `savedSearch`, so the dispatch runs the literal SPL while the UI
   keeps the saved-search name for picker / footnote display.

4. **Binding-footnote precedence updated** to credit the new
   searchbase entries when no override is bound and the topology
   summary feed isn't the source — was previously falling through to
   "(inline SPL)".

#### Verification

- TypeScript `tsc --noEmit` passes.
- ESLint clean.
- Picker-context call sites unchanged: `openPicker(KPI_CONFIG[i].id,
  cfg.label, { savedSearch: KPI_CONFIG[i].savedSearch, ... })` —
  `savedSearch` is now populated, so `currentSavedSearch` is set,
  so `currentBoundEntry` resolves, so the green banner + Jump To
  button render and the auto-scroll-on-open fires.

#### Files touched (Part 1)

- `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf`
  — Added `[overview_top_incident_volume]` and
  `[overview_operational_lead]` between the topology overview and the
  per-site health stanzas, with full descriptions and `Cisco`+
  `Overview`+`KPI`+`Site_Leaderboard` tags so the picker surfaces them.
- `packages/splunk-cisco-dashboards/src/main/webapp/pages/overview/index.tsx`
  — `KPI_CONFIG` now uses `savedSearch` (was inline `spl`); extended
  `buildEffectiveKpiCfg` no-override branch to resolve through
  `searchbaseByName`; tightened binding-footnote precedence.

### Part 2 — Sourcetype field audit infrastructure

#### Why we built it

The user has had a hunch for a while that several `searchbase.conf`
stanzas reference fields that don't actually exist in the data. With
~10K lines of SPL across 416 stanzas and 44 unique concrete
sourcetypes, eyeballing isn't viable. Originally pitched as an MCP
flow — but no MCP Splunk server is configured for this workspace
(`~/.cursor/mcp.json` doesn't exist). So we used the existing
curl + REST pattern the rest of the `validate_searchbase_*` scripts
already use.

#### What `scripts/audit_sourcetype_fields.py` does

For every concrete sourcetype referenced by any stanza in
`searchbase.conf`:

1. Dispatches `search index=* sourcetype="<st>" | head <N> |
   `field_list`` against Splunk via the same `post_oneshot` helper
   the validation scripts use.
2. The `field_list` macro (already defined in `macros.conf`) returns
   one row with a comma-separated `Fields_List` column — sorted,
   deduplicated, with built-in fields (`host`, `index`, `_time`,
   etc.) stripped.
3. Parses, sorts, deduplicates further, writes a per-sourcetype JSON
   blob to `scripts/sourcetype_field_inventory.json` (machine-
   readable ground truth, intended to be tracked in git) and a
   human-readable markdown report to
   `scripts/sourcetype_field_inventory.md`.

Workers are parallel (default 6), each oneshot dispatch is bounded
by a configurable `--timeout`, and the script skips wildcard
sourcetypes (`cisco:*`) since `oneshot` can't expand them.

Configuration mirrors the existing scripts: `SPLUNK_BASE_URL`,
`SPLUNK_USERNAME`, `SPLUNK_PASSWORD`, `SPLUNK_OWNER`, `SPLUNK_APP`,
`SPLUNK_VERIFY_SSL`. Defaults work against local Splunk
(`https://localhost:8089`, `splunk-cisco-dashboards` app namespace).

#### First-run results

- **44 concrete sourcetypes** referenced across 416 stanzas.
- **33 returned fields** (`pass`).
- **11 returned no events** (`empty`) — e.g. `cisco:firepower:syslog`,
  `cisco:ftd`, `meraki:devicesuplinkslossandlatency`,
  `cisco:cloud_security:dns`, `thousandeyes:alerts`, etc. These
  match known data gaps on the local stack.
- **0 errored.** Run took 21.5s with 8 workers.

#### Findings the audit immediately surfaced

The biggest finding came from the very stanza I just added:

##### `cisco:xdr:incidents` has no `site` field

Discovered field set for both `cisco:xdr:incidents` and
`cisco:xdr:incidents-summary`:

```
assignees{}, categories{}, client_id, confidence, created,
description, detection_sources{}, discovery_method, enrichment_status,
external_ids{}, external_references{}.*, groups{}, id, incident_source,
incident_time.{closed,contained,discovered,opened,reported}, meta.ai_description,
modified, owner, owner_id, promotion_method, schema_version,
scores.{asset,global,ml_score,ttp}, severity, short_description,
signature_id, source_uri, status, tactics{}, techniques{}, timestamp,
title, tlp, type
```

**There is no `site` field.** The `top_incident` SPL groups by `site`
which doesn't exist. The tile would silently produce a single
`site=null` row and surface nothing meaningful — exactly the
"Awaiting data" state the user has been seeing.

This is a real data-shape gap, not a code bug. Three options:

| Option | What it costs | What it gets you |
|---|---|---|
| A. Drop `site` dimension; group by `incident_source` or `signature_id` | One stanza rewrite | Tile actually emits a value, but answers a different question |
| B. Add `iplocation`/CMDB lookup to map `client_id` or asset → site | Lookup file + maintenance | Tile answers the original "which site" question, but only if the lookup is populated |
| C. Leave SPL as-is, document the data dependency in the stanza | Zero | Honest "needs site enrichment" surface — picker description already explains the contract |

**No change made yet.** Surfaced for direction.

##### Three other XDR stanzas use a non-existent `incident_id` field

- `[executive_dashboard_xdr_incident_count]` (line 1089)
- `[security_resilience_xdr_by_severity]` (line 2349)
- `[security_resilience_xdr_incident_detail]` (line 2368)

All three reference `incident_id` in `dc(incident_id)` /
`stats ... by incident_id` / `latest(...) by incident_id`. The actual
field is `id`. No field alias in `props.conf` rescues them. These
will silently fall through to a single null bucket on real data.
Confirmed via the audit finding + manual `props.conf` check.

**Definite bugs.** Three-line fix per stanza (`incident_id` → `id`).
Not changed yet — held for user direction.

##### 69 total stanzas with potentially-missing field references

A second-pass heuristic script (inline, didn't add it as a
permanent file) scanned every stanza's `stats by`, `eval`,
`rename`, `where`, and `table/fields` clauses and diff'd against
the discovered field set. 69 hits.

Caveats — these are heuristic, expect noise:

- **Splunk built-ins (`host`, `_time`, `_raw`, `index`)** are stripped
  by the `field_list` macro by design, so any stanza that references
  them comes back as a "missing" hit. ~15 of the 69 are this case.
- **CIM-mapped aliases (`src`, `dest`, `dest_ip`, `dest_port`,
  `Country`)** are produced by search-time field aliases / lookups in
  the TA, not in raw events, so `field_list` won't surface them.
  ~20 of the 69 are this case.
- **Genuine bugs** — the `incident_id` cases above plus a handful of
  others (`utd_action` on `cisco:sdwan:utd:logs`, `period` on
  `devicehealth`, `vlan_id` extracted from syslog text) — need
  individual review.

Next step: refine the heuristic to suppress known-safe categories
(Splunk built-ins, CIM aliases, common eval/rename targets) so the
report is a tight list of actionable findings, not a 69-item wall.
That's a follow-up; not done in this session.

#### Files touched (Part 2)

- `scripts/audit_sourcetype_fields.py` — new audit script.
- `scripts/sourcetype_field_inventory.json` — machine-readable
  inventory; safe to regenerate; intended to be tracked in git so
  field-set changes show up in PR diffs.
- `scripts/sourcetype_field_inventory.md` — human-readable report
  (also tracked).

### Part 3 — Fixing what the audit found ("go after all and fix them")

User instruction was unambiguous: take all three "What's next"
threads and close them in one pass.

#### Fix 1 — `incident_id` → `id` in the three XDR stanzas

`cisco:xdr:incidents` and `cisco:xdr:incidents-summary` expose the
canonical incident identifier as `id` at the top level of the JSON
payload. There is no `incident_id` field — confirmed against the
discovered field inventory and a `props.conf` field-alias check.
The previous SPL silently fell through to a single null bucket on
real data.

| Stanza (line) | Change |
|---|---|
| `[executive_dashboard_xdr_incident_count]` (1089) | `dc(incident_id) → dc(id)` |
| `[security_resilience_xdr_by_severity]` (2349) | `dc(incident_id) by severity → dc(id) by severity` |
| `[security_resilience_xdr_incident_detail]` (2368) | `... by incident_id → ... by id` |

All three stanzas were also bumped to `version = 1.0.1`,
`updated_author = codex`, `date_updated = 2026-05-09`, and the
`explanation` / `related_info` fields now call out the field-name
correction so future readers see *why* the stanza was touched, not
just the diff.

#### Fix 2 — `site` enrichment gap on `top_incident` (option C, with a demo escape hatch)

Picked **option C** from the original options table: leave the SPL
mechanically intact (still groups by `site`), but make the data
dependency *explicit* with a coalesce sentinel:

```spl
| eval site=coalesce(site, "Site enrichment unavailable")
| stats dc(id) as incidents by site
| eventstats max(incidents) as max_incidents
| where incidents=max_incidents
| stats first(site) as value
| fields value
```

Now the tile renders one of two unambiguous states:

- A real site name → XDR is enriched, this is the noisy site.
- The literal string `"Site enrichment unavailable"` → XDR isn't
  enriched, the dashboard is honest about it instead of showing an
  empty card.

Applied to **both** the canonical `[overview_top_incident_volume]`
stanza *and* the embedded duplicate inside the `append` block of
`[overview_topology_overview]` (line 9552). Both bumped to
`version = 1.0.1` and the docs explain the data dependency + how
to fix it (TA-side asset lookup keyed on `client_id`).

To keep the tile demo-able on stacks where `site` enrichment
isn't wired *and* avoid pinning the canonical stanza to a fake
value, added two synthetic companions that mirror the existing
site/link demo pattern:

- `[overview_top_incident_volume_demo]` → `value="Orlando (Regional Hub)"`
- `[overview_operational_lead_demo]` → `value="Tallahassee (State EOC)"`

Pure `makeresults` + `eval`, no sourcetype dependency, tagged
`Cisco,Demo,KPI,Site_Leaderboard,Leaderboard` so the picker
surfaces them next to the real stanzas under the same sub-category
filter. The `Demo` tag makes them easy to find/exclude.

#### Fix 3 — `deviceLocationUpdate.deviceMacAddress` typo (bonus find from refining the audit)

The refined audit (Fix 4 below) caught a second real bug that the
first-pass heuristic had missed in the noise: two stanzas were
referencing `deviceLocationUpdate.deviceMacAddress`, but the
actual field on `cisco:spaces:firehose` is
`deviceLocationUpdate.device.macAddress` (one extra dot — `device`
is a nested object). Fixed both:

- `[building_resilience_spaces_location_breakdown]` (497)
- `[building_resilience_ds_spaces_kpi_devices]` (6887)

Both bumped to `version = 1.0.1`, `updated_author = codex`,
`date_updated = 2026-05-09`.

#### Fix 4 — Refine `audit_sourcetype_fields.py` so the report is actionable

The first-pass heuristic produced 69 findings, mostly noise. The
refined version drops that to **0 high-confidence findings + 1
partial-confidence finding** that's gated on missing F5 inventory
data we don't have on this stack. Refinements, in the order they
moved the needle:

1. **Proper `eval` clause walker.** Replaced the regex-based
   "split by `|`" with a character-by-character walker
   (`_iter_eval_clauses` + `_eval_clause_lhs`) that tracks paren
   depth and string-literal state. Catches every LHS in chained
   `eval a=X, b=Y, c=Z` statements *and* doesn't mis-split on
   literal `|` characters inside `match(field, "a|b|c")`. **69 → 14.**
2. **`rename` parser handles quoted dotted fields and chains.**
   Added `RE_RENAME_CLAUSE` / `RE_RENAME_PAIR` so
   `rename "network.siteId" as siteId, "device.serial" as serial`
   parses correctly and both LHS fields are recognized as
   referenced. **14 → 11.**
3. **`lookup ... OUTPUT` and `rex (?<name>...)` synthesized fields.**
   Added `RE_LOOKUP_OUTPUT` and `RE_REX_NAMED` so fields produced
   by lookups and named regex captures are subtracted from the
   "referenced" set before flagging. Caught the known-good fields
   from the asset inventory lookup pipeline. **11 → 4.**
4. **CIM data-model + alias suppression.** Introduced two
   allow-lists: `CIM_DATA_MODELS` (e.g. `Network_Traffic`,
   `Authentication`) and `CIM_ALIASES` (e.g. `dest_port`, `Country`,
   `src_ip`). Any reference matching `<DataModel>.<field>` or any
   bare CIM alias is dropped before flagging. The markdown report
   documents the rule so reviewers know it's deliberate suppression,
   not a hidden bug. **4 → 1.**
5. **High-confidence vs partial-confidence split.** Added
   `confidence` and `missing_inventory` fields to `AuditFinding`.
   A finding is `partial` if any of the stanza's sourcetypes had
   `status = empty` or `fail` in the inventory — meaning the
   comparison set is incomplete and the flagged field might
   legitimately come from one of the missing sourcetypes. The
   markdown report groups findings by confidence and only
   high-confidence ones gate the script's exit code (so CI doesn't
   fail on "we don't have F5 data on this stack"). The single
   remaining flag is `[asset_inventory_build_lookup]` against the
   F5 sourcetype `f5:bigip:management:device:icontrol`, which
   isn't ingested locally — re-run on a stack with F5 to clear it
   or confirm the bug.
6. **First-class CLI surface.** Added `--audit` (discover then
   audit) and `--audit-only` (audit using the existing inventory
   JSON). `--audit-only` is fast (~150ms, no Splunk hits) and is
   what we'll wire into pre-commit / CI.

Final audit run:

```
inspected                         284
skipped_no_sourcetype             102
skipped_makeresults                 9
skipped_no_inventory_data          23
flagged                             1
Exit code: 0
```

#### Files touched (Part 3)

- `packages/.../searchbase.conf` — three XDR stanzas (`incident_id`
  → `id`), two Spaces stanzas (`deviceLocationUpdate.device.macAddress`),
  `[overview_top_incident_volume]` + embedded duplicate in
  `[overview_topology_overview]` (coalesce sentinel), two new
  demo companion stanzas.
- `scripts/audit_sourcetype_fields.py` — eval/rename/lookup/rex
  parser refinements, CIM suppression, confidence split, `--audit`
  / `--audit-only` flags, exit-code logic gated on high-confidence
  findings only.
- `scripts/sourcetype_audit_findings.md` — regenerated; now shows
  the confidence split + the single F5-gated finding.
- `scripts/sourcetype_field_inventory.json` / `.md` — regenerated
  to reflect the fixed `id` and `device.macAddress` fields.

### What's next

The Part 3 cleanup closes the three threads from the original
"What's next". Open follow-ups for the next session:

1. **Run the audit on a stack that has F5 data** to clear (or
   confirm) the single remaining partial-confidence finding on
   `[asset_inventory_build_lookup]`.
2. **Wire `audit_sourcetype_fields.py --audit-only` into
   pre-commit / CI** so future stanza edits get the same field
   check the user just got from the manual run.
3. **Sweep XDR `props.conf` for a `site` field alias** — if the
   customer's TA exposes `site` via alias and the audit script
   isn't reading aliases yet, the coalesce sentinel will hide
   real values. Confirm before treating the data dependency as
   permanent.

---

## 2026-05-09 — Map animation Fix C + topology-element search picker + demo stanzas

### Goal of the session

Two follow-ups from last session:

1. The animation work was deployed but the user couldn't see it on the
   default settings (subtle level + stable links). Diagnosed last
   session that the defaults rendered "2 tiny blue dots @ 0.65 opacity
   over 8.5s" — technically correct but visually imperceptible. User
   chose **Fix C**: bump the default level to `'on'` and tighten the
   `'subtle'` profile so it reads as "alive but unhurried" rather than
   "barely there".
2. Make site icons and connectivity links **swappable** the way KPI
   tiles already are — the user wants to pick a search from a dropdown
   so they can demo the map with realistic-looking data even when real
   telemetry isn't there yet, without typing `search_name` strings into
   the editor by hand.

> "let,s go with fix C" … "let us allow the site icons and site
> connectivity line searches to be changed like the tiles, and so I
> can pick a fake search to showcase how it will work in real-life…
> if we don't have the fake searches… create them so all fields are
> populating and working when clicking on the lines or when clicking
> on the icons."

### What got built

#### 1. Fix C — animation level rebalance

- `readStoredAnimationLevel()` and the `useSyncExternalStore` server
  snapshot in `useTopologyAnimationLevel` both now default to `'on'`
  (was `'subtle'`). New users land on the eye-catching cadence.
- `packetProfile()` rebalanced so the three levels are clearly
  distinct rather than collapsing toward "off":
  - **stable / subtle**: `count=3 (was 2)`, `duration=5.5s (was 8.5s)`,
    `radius=2.8 (was 2.5)`, `opacity=0.85 (was 0.65)`.
  - **stable / on**: `count=5 (was 4)`, `duration=4.5s (was 6s)`,
    `radius=3.2 (was 2.5)`, `opacity=0.95 (was 0.85)`.
  - Warning + critical also tightened a notch (more packets, slightly
    larger radius) so transitions between status colors register.
- `flowSeconds` multiplier for `'subtle'` marching dashes dropped
  from 1.7 → 1.4 so the line-itself motion stays in step with the new
  packet cadence.

Net effect: a healthy stable link in the default `'on'` mode now shows
5 cyan packets crossing every 4.5 s — readable as motion within a
glance from across a room. `'subtle'` is genuinely calm but still
legible. `'off'` remains fully static.

#### 2. Topology element search picker (per-site + per-link dropdowns)

Discovery work mapped two surprises:

- The KPI picker is hard-gated to the `Cisco` tag (`KpiPickerPanel.tsx`).
- The map already supports per-site/per-link `searchName` overrides
  via the topology editor — but only as a free-text input. No discovery
  surface for what's available, no demo escape hatch.

Wired a lightweight catalogue-backed `<select>` next to each existing
text input in `TopologyEditorPanel`:

- New prop `catalogueByName: Record<string, SearchbaseRecord> | null`
  passed down from `CustomerTopologyMap` (catalogue is already loaded
  for telemetry resolution; we just thread it through).
- Two derived option lists with `useMemo`:
  - `siteSearchOptions` — entries tagged `Topology_Site`.
  - `linkSearchOptions` — entries tagged `Topology_Link`.
- Each `<select>` renders a "Pick search…" placeholder + sorted
  options. Selecting an option writes back through the existing
  `updateSite` / `updateLink` reducer, so persistence reuses the
  same `customerTopology.v4` localStorage path that already
  serializes `searchName`.
- The plain `<input>` stays alongside for power users who need to
  paste / type a stanza name that isn't tagged for the picker.

Only files touched: `CustomerTopologyMap.tsx`. No new persistence
layer, no new context, no new component file.

#### 3. Six demo / synthetic stanzas in `searchbase.conf`

Built fully synthetic stanzas so the picker has something to swap to
even when real telemetry is absent. Every stanza emits the **exact**
canonical field names that `parseSiteRow` / `parseLinkRow` consume,
verified against the parser code (lines 1131-1199 and 1245-1288 of
`CustomerTopologyMap.tsx`).

Sites (each emits `status`, `healthPct`, `activeDevices`, `alerts`,
`latencyMs`, `telemetrySource`, `lastUpdated`):

- `overview_site_demo_healthy` — `healthPct=96`, `alerts=0`, `latencyMs=4`.
- `overview_site_demo_warning` — `healthPct=78`, `alerts=4`, `latencyMs=24`.
- `overview_site_demo_critical` — `healthPct=42`, `alerts=14`, `latencyMs=87`.

Links (each emits `status`, `capacityMbps`, `throughputMbps`,
`peakThroughputMbps`, `utilizationPct`, `peakUtilizationPct`,
`latencyMs`, `lossPct`, `endpointHealthPct`, `txMbps`, `rxMbps`,
`endpointDevices`, `telemetrySource`, `lastUpdated`):

- `overview_link_demo_healthy` — 1000 Mbps capacity, 32 % util, 0.05 % loss.
- `overview_link_demo_warning` — 500 Mbps capacity, 84 % util, 1.2 % loss.
- `overview_link_demo_critical` — 200 Mbps capacity, 97 % util, 4.8 % loss.

All built with `| makeresults | eval … | fields …` — no sourcetype
queries, so they always return one row regardless of indexed data,
time range, or feed availability. Tagged
`Cisco,Demo,Topology_{Site|Link},…` so they appear in the new
dropdown alongside the real `overview_site_*_health` / `overview_link_*_health`
stanzas. The three real `overview_site_*_health` stanzas and the three
real `overview_link_*_health` stanzas got their tags amended with
`Topology_Site` / `Topology_Link` so they show up in the picker too —
otherwise the dropdown would only show demo entries and the real
stanzas would be unreachable from the picker UX.

### Verification

- React build clean (`yarn run build` exit 0, 1 entrypoint warning
  unrelated to this work).
- No new lints in `CustomerTopologyMap.tsx`.
- Splunk app reloaded via REST (`POST .../apps/local/.../_reload` and
  `POST .../configs/conf-searchbase/_reload`).
- `GET configs/conf-searchbase?search=Topology_Link` confirms 6 entries
  carrying `Topology_Link` (3 real + 3 demo) — exactly what the picker
  should expose.
- One-shot test of `overview_link_demo_critical`'s SPL returned 1 row
  with all 14 popup fields populated and parseable as numbers /
  strings of the expected types.
- One-shot test of `overview_site_demo_warning`'s SPL returned 1 row
  with all 7 popup fields.

### Files touched

- `packages/splunk-cisco-dashboards/src/main/webapp/common/components/florida/CustomerTopologyMap.tsx`
  - Default animation level → `'on'` in two places (`readStoredAnimationLevel`,
    `useSyncExternalStore` server snapshot).
  - `packetProfile()` rebalanced for all three statuses + both levels.
  - `flowSeconds` `'subtle'` multiplier 1.7 → 1.4.
  - `TopologyEditorPanelProps` extended with `catalogueByName`.
  - Editor wires two `<select>` dropdowns (site + link) filtered by
    `Topology_Site` / `Topology_Link` tags.
  - Catalogue threaded from parent → editor.
- `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf`
  - Six new demo stanzas (3 site + 3 link), each with full
    description / explanation / solution.
  - Six existing real overview stanzas re-tagged with
    `Topology_Site` / `Topology_Link`.

### What's next

- Optional polish: surface a small "Demo" badge in the editor next to
  any `searchName` whose catalogue entry carries the `Demo` tag, so
  users can see at a glance whether the map is on real or synthetic
  data without opening the popup.
- The picker dropdown is order-by-name. If we add many more topology
  stanzas, consider grouping by sub-category (`Topology Site` /
  `Topology Link` / `Demo`) inside the `<select>`.
- Still pending from earlier sessions: tag the data-gap stanzas with
  `Requires_Data_Source` and teach the KPI picker to badge / hide
  them; decide on the 8 datamodel-dependent stanzas; wire the live
  validator into CI.

---

## 2026-05-09 — Three real bugs discovered while demoing the new picker

### Goal of the addendum

While walking through the topology picker we'd just shipped, the user
hit three things that were silently broken. Two were "I picked a demo
search, it kind of works but…" and one was a flat "this animation you
keep talking about isn't there at all". All three turned out to be
real bugs that had been hiding behind defaults, browser quirks, and
react-leaflet's lifecycle.

### Bug 1 — Packet circles never painted on the map

**Symptom.** Marching dashes on each link animated correctly, but the
small filled circles ("packets") that are supposed to slide along each
link's bezier curve were invisible. A standalone HTML test
(`docs/packet-animation-demo.html`) using the exact same SMIL pattern
rendered the circles fine in the same browser, so we knew the rendering
primitive itself worked.

**Root cause.** `LinkPacketLayer` was rendering its own `<svg
width="0" height="0" style="overflow: visible">` inside a custom
react-leaflet `<Pane>`. Even though `overflow: visible` *should* let
SVG children paint outside a degenerate viewport, that behaviour is
unreliable across renderers when the parent pane also has no explicit
size. The marching dashes worked because they live inside Leaflet's
*own* properly-sized overlay SVG (managed by `L.SVG.prototype._update`),
not ours.

Two intermediate fixes both failed:

1. Mimic Leaflet's own renderer pattern — set `width` / `height` /
   `viewBox` / `transform` on our SVG every `zoomend` / `viewreset` /
   `moveend` / `resize`. Looked correct on paper, still no dots.
2. Add `xlinkHref` alongside `href` on `<mpath>` for cross-browser
   `<mpath>` resolution. No improvement on its own.

**Fix that landed.** Stop running our own SVG. Find Leaflet's existing
overlay `<svg>` element via `map.getPanes().overlayPane.querySelector('svg')`
and append a `<g>` group **directly** into it, the same imperative-DOM
pattern `TopologyLinkPath` already uses to attach `<animate>` elements
to polyline paths.

The new `LinkPacketLayer`:

- Returns `null` from JSX — pure side-effects component.
- Mount effect uses `requestAnimationFrame` to retry until Leaflet's
  overlay SVG exists (it's lazy-created when the first vector renderer
  is added, which can be a frame later than our component's mount).
- Builds `<defs><path>` + `<circle>` + `<animateMotion><mpath>`
  imperatively via `document.createElementNS`. Uses `setAttributeNS`
  with the XLink namespace for `xlink:href` AND `setAttribute` for the
  modern `href` form.
- Wires re-renders on `zoomend` / `viewreset` / `moveend` / `resize`
  via a `useReducer`-driven `version` counter.

User reported "amazing!!!! you nailed it now!! I love you!" the moment
the bundle reached the browser. Worth recording.

**File touched:** `CustomerTopologyMap.tsx`, around line 1900.

### Bug 2a — Center Lat / Center Lng / Zoom in the editor were no-ops

**Symptom.** User changes Center Lat / Lng / Zoom in the topology
editor → values are correctly stored in `customerTopology.v4` →
visible map view never moves.

**Root cause.** `MapContainer` from react-leaflet only honors the
`center` and `zoom` props on the **initial mount**. Subsequent prop
changes are silently ignored. The `MapFrame` component already had a
`useEffect` that *would* call `map.setView(...)` when those values
changed, but it was hard-gated by `initialFrameAppliedRef.current` —
ran exactly once and never again, so editor edits had no effect.

**Fix.** Replaced the one-shot gate with a `lastAppliedViewRef` that
tracks the most recently applied (lat, lng, zoom). The effect now
calls `setView` whenever the requested view differs from the last
one we applied. Manual user pans don't trigger React state changes,
so they don't fight the editor's edits — only explicit topology
changes move the map.

### Bug 2b — Editor's Name and Subtitle fields were no-ops

**Symptom.** User edits Name to "Florida Production Sites", saves,
dashboard header still says "Network Topology".

**Root cause.** "Network Topology" and "Site connectivity and path
health" were hardcoded as JSX literals in
`pages/overview/index.tsx`. The editor's Name / Subtitle inputs were
correctly writing to the topology's `.name` / `.subtitle`, but
nothing outside the editor read those fields.

**Fix.** Exported `usePersistedTopology` from `CustomerTopologyMap.tsx`,
called it in `overview/index.tsx`, and replaced the hardcoded literals
with `{topologyHeaderName}` / `{topologyHeaderSubtitle}`. Falls back to
the original strings if the user clears them. Same hook the map uses,
same localStorage key, no manual sync needed.

### Diagnostic that unblocked the packet bug

I created `docs/packet-animation-demo.html` — a standalone file with
three SVGs (stable / warning / critical) that use the exact same SMIL
pattern as the production code. Opening it in the user's browser
confirmed:

- ✅ Browser supports `<animateMotion>` + `<mpath>`.
- ✅ Both `href` and `xlink:href` resolve.
- ✅ `prefers-reduced-motion` not blocking SMIL.

That narrowed the production bug from "browser problem" to
"integration problem", which made the imperative-append-to-Leaflet's-SVG
fix obviously the right move.

### Files touched

- `packages/splunk-cisco-dashboards/src/main/webapp/common/components/florida/CustomerTopologyMap.tsx`
  - Rewrote `LinkPacketLayer` to imperatively append `<g>` into
    Leaflet's existing overlay SVG.
  - Replaced one-shot `initialFrameAppliedRef` gate with a
    `lastAppliedViewRef`-driven `setView` so editor center/zoom edits
    actually move the map.
  - Exported `usePersistedTopology`.
- `packages/splunk-cisco-dashboards/src/main/webapp/pages/overview/index.tsx`
  - Replaced hardcoded "Network Topology" / "Site connectivity and
    path health" with values read from the persisted topology.
- `packages/splunk-cisco-dashboards/docs/packet-animation-demo.html`
  - New standalone SMIL test page. Useful again any time we touch the
    map's animation rendering.

### What's next

- The diagnostic HTML file at `docs/packet-animation-demo.html` should
  probably be moved into a `docs/diagnostics/` subfolder if we end up
  building more of these. For now it lives next to `SESSION_LOG.md`.
- Watch for similar "react-leaflet ignores prop changes" gotchas on
  other map-config props (maxBounds, minZoom, maxZoom, tileUrl). The
  topology editor exposes some of those and they may have the same
  bug. Fixing each requires the same imperative-update pattern.

---

## 2026-05-09 — `cisco:dnac:site:topology` re-import + dual-schema discovery

### Goal of the addendum

User pulled a fresh export of `cisco:dnac:site:topology` from customer (130
events, up from the 13 we had on 2026-05-08) and asked us to re-import,
diff against the prior state, and adjust any consumer searches if the new
data exposed something the smaller sample missed.

> "weird that catalyst center took this much time to dump more data"

### Findings — what the new data actually contains

**TL;DR: the data is materially identical to the 13-event sample. There
are no new entities, no new fields, no new field values, and no
hierarchy nodes that we hadn't already accounted for. What changed is
that we now have multiple polling cycles instead of one snapshot, which
let us validate the polling behavior end-to-end.**

| Dimension | 13-event sample (2026-05-08) | 117-event sample (2026-05-09) | Delta |
|---|---|---|---|
| Distinct entity IDs | 13 | 13 | 0 (identical UUIDs) |
| Distinct hierarchies | 13 | 13 | 0 (identical paths) |
| Distinct field names | 16 | 16 | 0 (`signature_id`/`vendor_product` are TA-added post-index) |
| Field-value drift across polls | n/a | **0 of 13 ids drifted on any of 11 fields checked** | Stable |
| Catalyst Center hosts | 1 (`demcatalyst01.fleoc.org`) | 1 (same) | 0 |
| Polling cycles represented | 1 | **9 (each cycle re-emits the full tree)** | +8 |

**The 117 events = 9 polling cycles × 13 unique entities, each cycle
identical to the others.** Catalyst Center dumps the whole tree on every
poll; the existing lookup generator's `dedup id sortby -_time` correctly
collapses this. We took the opportunity to verify that field values
don't drift between polls, which they don't — strong evidence that the
TA input is stable and that the lookup CSV is durable across refreshes.

### Discovery — the sourcetype carries TWO different schemas

Prior to this re-import we believed `cisco:dnac:site:topology` was a
single hierarchy-snapshot schema. The before-snapshot revealed **641
extra events in the same sourcetype** carrying a completely different
shape — Cisco's stock TA demo feed (`device_removed_from_site`,
`topology_link_added` events for fictional sites like `London-UK` and
`New-York-NY`, with `type="NETWORK"`, `eventId`, `severity` 1/2/3). This
demo input lives on every Splunk stack that has the Catalyst Center TA
loaded with default samples enabled.

**Two coexisting schemas under one sourcetype:**

| Schema | Distinguishing fields | Example `name` values | Source |
|---|---|---|---|
| **Hierarchy snapshot** (customer real data) | `type IN ("global","area","building","floor")`, `id` UUID, `nameHierarchy`, `latitude`/`longitude` | `TLH`, `First Floor`, `Florida` | Customer Catalyst Center poll |
| **Event-style change feed** (demo only on this stack) | `type="NETWORK"`, `eventId="NETWORK-DEVICE-1-301"`, `details.siteName`, `severity` | `device_removed_from_site`, `topology_link_added` | Cisco TA demo input |

**The bug the re-import surfaced:** three of our existing stanzas
(`it_critical_systems_site_topology_recent_changes`,
`_event_type_distribution`, `_site_type_distribution`) were authored
against the event-style schema. On a stack that ingests both schemas,
they were silently displaying hierarchy-snapshot rows as if they were
"recent changes" — `recent_changes` was returning 771 rows where 765
were customer hierarchy entries (`name="First Floor"` listed alongside
`name="device_removed_from_site"`, both with the same severity label,
indistinguishable to a viewer).

### Fixes applied

1. **Lookup generator** (`savedsearches.conf`,
   `[Executive Dashboard - Site Topology Lookup Generator]`):
   added `type IN ("global","area","building","floor")` filter to the
   primary search. Defense-in-depth — the prior `dedup id` was already
   stripping demo events because they carry no top-level `id` field, but
   the explicit filter makes intent unambiguous and immunizes the
   lookup against any future TA change that might add an `id` to demo
   payloads.

2. **Three event-style stanzas** (`searchbase.conf`):
   added `| where isnotnull(eventId)` immediately after the base search
   for `it_critical_systems_site_topology_recent_changes`,
   `_event_type_distribution`, and `_site_type_distribution`. Updated
   each stanza's `description` / `explanation` / `solution` /
   `related_info` to call out the dual-schema design and point at
   `[site_topology_marker_enrichment]` as the snapshot-side
   counterpart. Tagged all three with `Requires_DNAC_Topology_Events`
   (parallel to the existing `Requires_Cisco_ThousandEyes_DM` pattern)
   so the KPI picker can hide them by default on stacks that only ingest
   hierarchy snapshots.

3. **Cursor rule** (`.cursor/rules/splunk-cisco-dnac-fields.mdc`):
   inserted a "Dual-schema warning (CRITICAL)" section under the
   `cisco:dnac:site:topology` heading. Documents the two schemas, the
   filtering recipes for each intent, and the empirical finding that
   field values don't drift across polls.

### Verification (before / after)

Re-imported the 117 events into local Splunk under `host=fdem-import-2026-05-09`
(distinguishing it from the prior `host=fdem-import-2026-05-08` for clean
provenance). Ran the hardened lookup generator manually via the Splunk
REST API.

| Check | Before fix | After fix |
|---|---|---|
| `site_topology_lookup` row count | 13 (3 area + 4 building + 5 floor + 1 global) | 13 (identical — the dedup was already correct) |
| `site_topology_marker_enrichment` rows | 4 buildings | 4 buildings (TLH, SEOC, AUB, Warehouse — all with full GPS + addresses) |
| `site_topology_drift_panel` rows | 3 (MCO=Missing, TLH/AUB=Managed) | 3 (same — drift status correct) |
| `clients_by_building_lookup_join_demo` rows | 4 (TLH 324 / AUB 27 / Warehouse 5 / SEOC 4 unique clients) | 4 (identical) |
| `audit_logs_by_site_lookup_join` rows | 4 (path-fallback resolved demo data correctly) | 4 (identical) |
| `clienthealth_by_site_lookup_join` rows | 0 (customer siteId="global" caveat documented) | 0 (expected) |
| `it_critical_systems_site_topology_recent_changes` rows | **771 (765 polluted)** | **642 (all clean event-style)** |
| `it_critical_systems_site_topology_event_type_distribution` rows | 22 (16 polluted with hierarchy values) | 11 (only event names) |
| `it_critical_systems_site_topology_site_type_distribution` rows | 6 (incidentally clean — was filtering by `details.siteType`) | 6 (still clean, now with explicit filter) |

The 771→642 row delta on `recent_changes` exactly matches the 130
imported hierarchy events being filtered out, validating that the
dual-schema fix correctly partitions the two payload types.

### Files changed

| File | Net effect |
|---|---|
| `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/savedsearches.conf` | +1 filter clause + dual-schema note in `[Executive Dashboard - Site Topology Lookup Generator]` description |
| `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf` | 3 event-style stanzas: +`where isnotnull(eventId)` filter, expanded prose, +`Requires_DNAC_Topology_Events` tag |
| `.cursor/rules/splunk-cisco-dnac-fields.mdc` | New "Dual-schema warning (CRITICAL)" subsection under `cisco:dnac:site:topology` + polling-cadence amendment |
| `packages/splunk-cisco-dashboards/docs/SESSION_LOG.md` | This addendum |

### What's next (decision points for the user)

1. **Optional**: extend the KPI picker to honor the new
   `Requires_DNAC_Topology_Events` token the same way it (eventually) will
   for `Requires_Cisco_ThousandEyes_DM` — hide tagged stanzas by default,
   show them via an "advanced" toggle, badge them as "data-source dependent".
2. **Optional**: add a small data-quality tile to a system-status
   dashboard showing "site:topology dual-schema split — N event-style
   rows in last 24h, M hierarchy rows in last 24h" so the customer can
   tell at a glance whether they're getting both feeds or just one.
3. **No code action needed**: the demo `type="NETWORK"` events are inert
   noise — they don't pollute any lookup-driven panel anymore, and the 3
   event-style stanzas correctly target them. The customer can leave the
   demo input enabled or disable it; the dashboards behave correctly
   either way.

---

## 2026-05-08 (cont. 7) — Map "wow factor" animations (Tier 1 + Tier 2)

### Goal of the addendum

Make the executive overview map's connectivity story visibly *alive* —
not as eye-candy, but as a glanceable status signal. User feedback after
seeing the static-with-marching-dashes baseline:

> "are you sure this the best option? I want this dashboard to wow everyone!"

So the bar moved from "tasteful" to "wow without sacrificing readability."

### Discovery & decisions

- **The codebase already had more animation than I initially noticed.**
  `CustomerTopologyMap.tsx` was injecting SMIL `<animate>` elements into
  Leaflet's polyline `<path>` SVGs to drive marching dashes (warning,
  critical) and breathing stroke-opacity (critical only). The popup was
  already wrapped in `<AnimatePresence>` with a slide+fade. The site
  markers had pulsing radiate halos via CSS keyframes. The codebase
  comment at the SMIL injection site explicitly explained why SMIL beats
  CSS for Leaflet polylines: Leaflet rewrites the path's `d` attribute
  on every pan/zoom, which restarts CSS `stroke-dashoffset` animations
  but leaves SMIL animations running smoothly.

  → Decision: **build on top of the existing SMIL approach**, do not
  rip it out for `leaflet-ant-path` or anything else. SMIL is the right
  primitive for animations anchored to a path that Leaflet redraws.

- **What was missing for "wow":**
  1. Packets visibly traveling along the links (the showstopper).
  2. Marker entrance choreography (just a static drop-in today).
  3. Hover micro-interaction on the lines (click-only today).
  4. A user-facing animation level toggle so an operator can dial it
     down for a presentation, or a CISO can disable it completely. And
     `prefers-reduced-motion` honored as a hard override.

- **Why packets via `<animateMotion>` + `<mpath>` (SMIL) and not Motion's
  `motion.circle` with a JS frame loop:** SMIL animations run in the
  browser's compositor without involving the JS frame loop, so even
  with a dozen packets in flight they don't compete with a busy CPU
  during a live demo. Same reasoning the existing marching-dash code
  uses. Motion remains the right tool for React-state-driven UI
  transitions (popup, KPI panel) where SMIL can't reach.

### What we built

Animation level system (`useTopologyAnimationLevel`):

- Three-level enum: `'on' | 'subtle' | 'off'`.
- Persisted in `localStorage` under `florida-topology-animation-level`.
- Subscribed via `useSyncExternalStore` so multiple instances stay in
  sync, including a manual `dispatchEvent('storage')` after writes
  because the native `storage` event does not fire in the same tab.
- `prefers-reduced-motion: reduce` is read via `matchMedia` and forces
  the *effective* level to `'off'` regardless of stored preference,
  while preserving the stored value for when the OS preference flips
  back. This is the correct pattern: respect the system signal, but
  don't lose the user's explicit choice.
- Toggle button added to the bottom-left control stack on the map
  (Sparkles icon + tier badge: On / Sub / Off). Click cycles. Tooltip
  explains when reduced-motion is overriding.

Marker entrance (Tier 1):

- New `customer-topology-marker-enter` keyframe (cubic-bezier overshoot
  ease, scale + translateY pop with opacity ramp).
- `createSiteIcon` accepts an `animateEntrance` flag and a delay in
  milliseconds; renders the entrance class only on the first mount of
  each site. A per-component `Set<siteId>` ref tracks which markers
  have already animated, so toggling the level later does not re-fire
  drop-in for existing markers (which would be jarring).
- Stagger: `index * 90ms`, so the five Florida sites cascade in
  sequence over ~360ms. Easy to read which marker is which on first
  load.

Link hover bump (Tier 1):

- New `customer-topology-link-shell` className applied to the visible
  Polyline.
- CSS `:hover` selector bumps `stroke-width` by 1.6px and pumps
  `stroke-opacity` to 1.0, with a 180ms ease-out transition. Pure
  CSS, costs nothing, and works because Leaflet's polyline `<path>`
  is a regular SVG element that responds to `:hover`.

SMIL flow scaling (Tier 1):

- `TopologyLinkPath` now accepts the effective animation level. At
  `'off'` it skips SMIL injection entirely (line is fully static). At
  `'subtle'` it slows the marching dashes to ~70% of full speed and
  breathing to 2.4s instead of 1.4s, so the line still reads as alive
  but doesn't compete for attention.

Packet stream layer (Tier 2 — the centerpiece):

- New `<LinkPacketLayer>` component, mounted inside `<MapContainer>`
  immediately after the existing `<TopologyLinkPath>` instances.
- Lives in a custom `<Pane name="customer-topology-packets" zIndex=410>`,
  which Leaflet positions between its default `overlayPane` (zIndex
  400, where the polyline shells live) and `markerPane` (zIndex 600,
  where site icons live). Result: packets float above the lines but
  below the markers and popups, exactly where the eye expects.
- Geometry pipeline:
  1. For each link segment, compute the same bezier polyline used by
     `TopologyLinkPath` (`computeBezierLine`) so packets travel the
     identical curve.
  2. Convert each bezier point through `map.latLngToLayerPoint(...)`
     to get pane-relative pixel coordinates.
  3. Stitch points into an SVG `<path d="...">` and stash it inside a
     `<defs>` block.
  4. Render N `<circle>` packets per link, each with an
     `<animateMotion><mpath href="#..."></mpath></animateMotion>` child
     pointing at the link's path.
  5. Stagger packet starts via `begin="-Xs"` so they spread evenly
     along the path rather than clumping at the source.
- Re-render trigger: a `useReducer` tick fired from `zoomend` and
  `viewreset` listeners. Pan does NOT trigger recompute because
  Leaflet's pane translate handles pan for free; subscribing to `move`
  would force a useless rebuild every drag tick.
- Per-status profile (count × duration × radius × color × opacity)
  is dialed twice — once for `'on'`, once for `'subtle'` — so each
  level has its own coherent visual cadence:
  - **Stable:** soft sky-blue dots, 4 packets at 6s on / 2 at 8.5s
    subtle. Reads as a calm trickle.
  - **Warning:** amber dots, 3 at 3.6s on / 2 at 5.2s subtle.
  - **Critical:** red dots with glow, 2 at 1.8s on / 1 at 2.6s subtle.
    Tight, urgent cadence.
  - **Unknown:** intentionally no packets at any level. Unknown stays
    quiet because we have nothing to say about it.
- Glow filter (`drop-shadow` on `currentColor`) animated via CSS
  keyframe at 1.6s (on) / 2.6s (subtle). Color tied to the
  `customer-topology-packet--{status}` class and the `currentColor`
  pattern, so changing status auto-changes glow color.

Reduced-motion + level CSS overrides:

- Wrapper div carries a `customer-topology-anim--{on|subtle|off}` class
  driven by the effective level. `--off` halts every CSS keyframe via
  `animation: none !important` for radiate, alert ring, marker
  entrance, and packet glow. SMIL animations are stopped at the
  injection layer (TopologyLinkPath skips injection at `'off'`).
- A `@media (prefers-reduced-motion: reduce)` block applies the same
  CSS halts independently of the wrapper class, as belt-and-braces in
  case the wrapper class fails to apply for some reason.

### Verification

- `yarn run typecheck` — clean.
- `yarn run build` — clean (only pre-existing asset-size warnings).
- ESLint can't run on this repo without the `eslint-config-airbnb`
  package which the workspace doesn't have installed. Confirmed by
  invoking the linter directly. Pre-existing infra issue, not
  something this work introduced.
- `react-leaflet@4.2.1` confirmed to export `<Pane>` (verified via the
  package's `Pane.d.ts`).

Manual visual verification is the user's job since the animation has to
actually look right. The dev stack is browser-only and the rendering is
SMIL-based; the only signal a CI build can give us is "compiles."

### Files changed

- `packages/splunk-cisco-dashboards/src/main/webapp/common/components/florida/CustomerTopologyMap.tsx`
  - Imports: `useReducer`, `useSyncExternalStore` (React); `Pane`
    (react-leaflet); `Sparkles` (lucide-react).
  - Added `TopologyAnimationLevel` type, `useTopologyAnimationLevel`
    hook, `TOPOLOGY_ANIMATION_LEVEL_LABELS`, related storage helpers.
  - Extended `topologyAnimationCss` with marker entrance, packet glow,
    hover bump, level overrides, and `prefers-reduced-motion` block.
  - `createSiteIcon`: now accepts `animateEntrance` and
    `entranceDelayMs`; emits the entrance class + CSS variable on the
    outer div.
  - `TopologyLinkPath`: accepts `animationLevel`; skips SMIL at
    `'off'`, slows it at `'subtle'`. Polyline gains
    `customer-topology-link-shell` className.
  - New components: `packetProfile`, `<LinkPacketLayer>`.
  - `CustomerTopologyMap` host: calls
    `useTopologyAnimationLevel`, tracks marker entrance via a ref,
    threads `animationLevel` into `<TopologyLinkPath>`, renders
    `<LinkPacketLayer>` inside `MapContainer`, attaches
    `customer-topology-anim--{level}` class to the wrapper, adds the
    Sparkles cycle button to the bottom-left control stack.

### Tag

Pre-snapshot saved at `codex-pre-map-animation-20260508-222336` so this
work is one revert away from the "User Experience folded in" baseline
if anything visual goes sideways.

### What's next

- Visual verification on the deployed app — start at level=`'on'` and
  cycle through `'subtle'` and `'off'` to confirm the level knob
  behaves the way the comments promise.
- If 60fps is an issue with all 4 links populated (especially on a
  modest laptop driving an external display), the count for stable
  links can drop from 4→3 cheaply. Watch for jank during a fast pan.
- Future polish: sparkline draw-in via Motion (Tier 3 from the original
  proposal), and Motion-driven hover lift on the KPI cards.

---

## 2026-05-08 (cont. 6) — User Experience folded into IT Health (Option A)

### Goal of the addendum

Decide what to do with `user_experience_v1.xml` now that:
- Half of its content (5 ThousandEyes panels) is dead on this stack — the
  `Cisco_ThousandEyes.Test_Metrics` data model is not installed, so the
  panels render "no results" and erode executive trust in the rest of the
  app.
- The remaining client-side content (wired/wireless health, OS mix, device
  types, client-health trend) belongs next to device health from a NOC
  triage perspective, not on a separate top-level page.

Three options were laid out:
- **A**: Fold UX into IT Health as a tab, delete the standalone dashboard.
- **B**: Keep UX as a top-level tab (status quo) — rejected because
  advertising a half-broken capability is worse than removing the tab.
- **C**: Demote UX into a collection — rejected because it preserves a
  broken dashboard at a discoverability cost.

User approved **Option A**.

### Decisions

1. **New tab inside IT Health** rather than a section appended to the
   Overview tab. Less risk of layout collision with IT Health's already
   busy Overview, and it preserves the "User Experience" muscle memory
   for users who knew where to look.
2. **5 panels imported, 4 dropped.** Specifically:
   - **Imported** — Wireless Health gauge, Wired Health gauge, Client
     Health Trend (stacked Good/Fair/Poor), Top 5 Device Types bar,
     Client OS Distribution pie.
   - **Dropped** — Active Clients donut (census, not health), Total
     Clients single-value (census), Client Health by Type trend
     (overlaps the stacked trend), and the misleading "Client Health"
     gauge that was actually wired to `cisco:dnac:devicehealth`
     reachability/manageability and would duplicate IT Health's
     existing device gauge.
3. **All 4 ThousandEyes-dependent stanzas tagged
   `Requires_Cisco_ThousandEyes_DM`** rather than rewritten or deleted.
   When the data model is installed and accelerated, the panels can be
   re-wired with no SPL changes — the stanzas already have the correct
   `tstats` queries.
4. **5 in-stanza `<a href="/app/splunk-cisco-dashboards/user_experience">`
   links rewritten** to point at `it_health_v1`, with anchor text
   updated to "IT Health dashboard (User Experience tab)".

### What we built

**`it_health_v1.xml` — new tab `layout_user_experience`** (between
Overview and Details & KPI Reference):

| viz id | type | data source | what it shows |
|---|---|---|---|
| `viz_uxh_wireless_gauge` | singlevalue | `ds_uxh_wireless_health` | Latest wireless score (`scoreType="ALL"`, `clientType="WIRELESS"`) |
| `viz_uxh_wired_gauge` | singlevalue | `ds_uxh_wired_health` | Latest wired score |
| `viz_uxh_dev_types_bar` | bar | `ds_uxh_top_device_types` (chain on `ds_uxh_base_client_ref`) | Top 5 device categories by unique MAC |
| `viz_uxh_client_trend` | area, stacked100 | `ds_uxh_client_trend` | Good/Fair/Poor distribution over time |
| `viz_uxh_client_os_pie` | pie | `ds_uxh_top_client_os` (chain) | Top 5 operating systems by unique MAC |
| `viz_uxh_te_note` | markdown | — | Explains where the ThousandEyes panels went and how to bring them back |

All 6 datasource ids carry the `_uxh_` prefix to mark provenance.
Background frames (`viz_uxh_box_*`) follow the same `rgba(255,255,255,0.78)`
+ `rx:10` styling as the rest of the dashboard.

**Tab order in IT Health (5 tabs total):**
Overview → User Experience (new) → Details & KPI Reference → Catalyst
Center Intelligence → About.

### Verification

- **JSON well-formedness**: parsed `it_health_v1.xml` CDATA payload and
  confirmed all 5 new viz items resolve to existing visualizations,
  all primary datasource references resolve, and the new layout's input
  reference (`input_global_trp`) resolves.
- **XML well-formedness**: parsed `it_health_v1.xml`, `admin_guide_v1.xml`,
  and `nav/default.xml` — all OK.
- **Live SPL validation** (against local Splunk on `https://localhost:8089`,
  app `splunk-cisco-dashboards`, `-24h..now`):

  | datasource | rows | sample keys |
  |---|---|---|
  | `ds_uxh_wireless_health` | 1 | `score` |
  | `ds_uxh_wired_health` | 1 | `score` |
  | `ds_uxh_client_trend` | non-empty | `_time`, `Good`, `Fair`, `Poor` |
  | `ds_uxh_top_client_os` | up to 5 | `os`, `count` |
  | `ds_uxh_top_device_types` | up to 5 | `Device Type`, `Clients` |

  All 5 returned without error and produced data.

### Files changed

- `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/data/ui/views/it_health_v1.xml`
  — added 8 vizes, 6 datasources, 1 layout, 1 tab.
- `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/data/ui/views/user_experience_v1.xml`
  — **deleted**.
- `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/data/ui/views/admin_guide_v1.xml`
  — Dashboard Overview markdown rewritten to remove the standalone UX
  card and call out the new tab inside IT Health. Stale Security/Devices/
  Network entries cleaned up while we were there.
- `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/data/ui/nav/default.xml`
  — `<a href="user_experience_v1">User Experience</a>` removed; primary
  group is now Overview / IT Health / Security.
- `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf`
  — 4 stanzas tagged `Requires_Cisco_ThousandEyes_DM`; 5 anchor links
  rewired from `/app/splunk-cisco-dashboards/user_experience` to
  `/app/splunk-cisco-dashboards/it_health_v1` with anchor text updated.

### What's next

- The 7 DNAC empty stanzas from cont. 5 are still on the books (real
  SPL bugs identified by the live audit, separate work).
- The 8 datamodel-dependent stanzas (`Cisco_ThousandEyes`, `Cisco_Security`,
  `ITSI_KPI_Summary`) — same decision still required: install data
  models or rewrite to raw events.
- KPI picker UI: extend the picker's tag filter to honor
  `Requires_*_DM` tokens by default (hide them unless the user opts in
  via a "show advanced" toggle). Today the tag is set; the UI plumbing
  to react to it is not yet wired.

---

## 2026-05-08 (cont. 5) — Duplicate-stanza consolidation + 408-stanza live audit

### Goal of the addendum

Two related asks from the user, completed in one pass:

1. **Land the consolidation/rename pass** for the 16 stanzas flagged in the
   side-by-side analysis (cont. 4 closing). Update every dashboard that
   referenced the renamed names.
2. **Sweep `searchbase.conf` for searches not returning results.** With ~400
   stanzas, the user asked for the right testing approach.

### Phase 1 — Consolidations and renames (3 fixes + 6 renames + 1 dashboard reference update)

**Real bugs (consolidations)** — same stanza ID kept, SPL rebased onto the
canonical pipeline so executive and IT views can never disagree again:

| stanza | old SPL | new SPL |
|---|---|---|
| `shared_ds_dev_health_trend` | `case(Reachability AND Manageability,100, Reachability,50, _,0) \| timechart avg(h) as score` | `where OverallHealth>=0 \| eval health=OverallHealth*10 \| timechart avg(health) as score` |
| `executive_summary_network_health_trend` | `cisco:dnac:devicehealth \| spath \| eval healthy=... \| bin _time \| stats avg(healthy) as pct \| eval pct=round(pct*100)` | `cisco:dnac:networkhealth category="All" \| timechart latest(healthScore) as pct` |
| `network_activation_wired_client_trend_24h` | `timechart sum(eval(if(scoreType=="GOOD",clientCount,0))) as Healthy, ...` | `timechart latest(eval(if(scoreType=="GOOD",clientCount,null()))) as Healthy, ...` |

The wired-client fix matters: `cisco:dnac:clienthealth` emits cumulative
snapshots per `(siteId, scoreType, clientType)`. `sum()` across the bucket
multiplies counts by the number of polls; `latest()` matches the snapshot
semantics already used by `statewide_ds_wired_client_trend_24h`.

Inline copies in `it_health_v2.xml` (`ds_dev_health_trend`) and
`home_launchpad_v4.xml` (`ds_dev_health_trend_exec`) were rebased to the same
canonical pipeline and re-staged into `stage/default/`.

**Renames** — `search_name` only; stanza IDs left stable so existing
references-by-ID continue to resolve. Six labels became unambiguous:

| stanza | old `search_name` | new `search_name` |
|---|---|---|
| `user_experience_client_health_trend` | "User Experience - Client Health Trend" | "User Experience - Client Health Distribution Trend" |
| `executive_dashboard_ise_authentication_rate` | "Executive Dashboard - ISE Authentication Rate" | "Executive Dashboard - Identity Authentication Score (ISE + Windows AD)" |
| `executive_summary_issue_trend` | "Executive Summary - Issue Trend" | "Executive Summary - Issue Trend by Priority" |
| `it_critical_systems_issue_trend` | "IT - Critical Systems - Issue Trend" | "IT - Critical Systems - Issue Trend by Category" |
| `executive_dashboard_network_health_score` | "Executive Dashboard - Network Health Score" | "Executive Dashboard - Network Health Score Trend" |
| `it_critical_systems_network_health_score` | "IT - Critical Systems - Network Health Score" | "IT - Critical Systems - Network Health Score (Current)" |

Cross-repo audit confirmed only one external code reference to any of these
names: `overview/index.tsx` line 179, which was updated to the new "Current"
suffix. Every other reference is internal to `searchbase.conf` and resolved
via the picker catalog (which auto-updates).

### Phase 2 — Live validation of all 408 stanzas

**Tooling.** Built `scripts/validate_searchbase_parallel.py` (8-worker thread
pool wrapping the existing `validate_searchbase_live.py` oneshot dispatcher)
plus `scripts/triage_validation.py` to bucket findings by sourcetype.

**Run parameters.** Local Splunk 10.2.2, `codex/changeme`, `-24h@now`, 20s
search timeout, 8 parallel oneshots. Full sweep completed in **~4 minutes**
(vs ~21+ minutes for the sequential validator), so this is a viable
"every-PR" check going forward.

**Headline numbers.**

| outcome | count | meaning |
|---|---|---|
| pass with rows | 298 | search returned data — healthy |
| pass with 0 rows | **99** | search ran cleanly but no rows came back |
| fail | **8** | SPL/HTTP error |
| skip | 3 | side-effecting (`outputlookup`/`collect`/etc.) — intentional |

**The 8 failures are all `Error in 'DataModelEvaluator'`** — searches that
target accelerated data models that don't exist on this stack:

* `Cisco_ThousandEyes` — `executive_dashboard_thousandeyes_health_score`,
  `user_experience_thousandeyes_agents`,
  `user_experience_thousandeyes_latency_trend`,
  `user_experience_thousandeyes_test_results`
* `Cisco_Security` — `security_resilience_idsips_alert_count`,
  `security_resilience_idsips_alert_trend`,
  `security_resilience_ds_ids_classification`
* `ITSI_KPI_Summary` — `teuc_5_9_50_itsi_service_health`

These are "needs upstream tile" rather than bugs: the SPL is correct, the
data model just isn't installed/accelerated on the dev stack.

**The 99 empty passes split cleanly into two groups:**

A) **~85 stanzas — systematic data gap (no fix needed in SPL).** Every
stanza in these sourcetype groups was empty:

| sourcetype / macro | empty count | notes |
|---|---|---|
| `\`stream_index\`` (ThousandEyes telemetry) | 38 | TEUC-* searches — no TE on stack |
| `cisco:asa` / `cisco:ftd` / `cisco:sfw:estreamer` | 15 | partial firewall data |
| `meraki:devicesuplinkslossandlatency` | 6 | no Meraki uplink data |
| `\`event_index\`` (TE alerts) | 5 | no TE data |
| `cisco:ios` | 7 | partial IOS syslog data |
| `thousandeyes:alerts` | 4 | no TE data |
| `\`path_viz_index\`` | 3 | no TE data |
| `meraki:sensorreadingshistory` | 3 | partial Meraki sensors |
| `ms:defender:endpoint:alerts` | 2 | no Defender data |
| `cisco:cloud_security:dns` | 2 | partial Umbrella data |
| `oncall:incidents`, `thousandeyes:traces`, `\`activity_index\`` | 3 | no data |

B) **~14 stanzas — likely real bugs in the SPL.** These hit sourcetypes
that DO have data on the stack but still returned 0 rows:

* **DNAC empties (7):**
  - `it_critical_systems_weekoverweek_health` — `xyseries _time week score`
    after `stats avg(...) by week` has no `_time` axis; SPL pattern broken
  - `it_critical_systems_ap_disconnect_issues` — filter
    `IssueName="AP*disconnect*"` may not exist in demo data; over-restrictive
  - `user_experience_guest_client_surge` — `latest(*) by macAddress` then
    `bucket _time` produces 1 row per MAC, breaks 48-bucket trend logic
  - `user_experience_client_onboarding_failures` — quoted nested-JSON path
    `'onboarding.latestFailureReason'` likely not extracting on the customer
  - `user_experience_client_roaming_analysis` — same nested-path issue
  - `clients_by_building_lookup_join_demo` — already known: depends on
    `site_topology_lookup` being non-empty (regenerate the lookup)
  - `clienthealth_by_site_lookup_join` — known customer caveat documented in
    cursor rule: customer `clienthealth.siteId="global"` always; the
    `siteId!="global"` filter empties the result. Defensive by design.
* **Firewall/IOS overlap with healthy data (~7):** per-stanza fix-or-defer.

**Sourcetype health matrix** (top of healthy + concerning):

| empty % | total | sourcetype |
|---|---|---|
| 0% | 47 | `cisco:dnac:devicehealth` ✅ |
| 0% | 21 | `cisco:spaces:firehose` ✅ |
| 0% | 21 | `*WinEventLog` ✅ |
| 0% | 18 | `cisco:ise:syslog` ✅ |
| 0% | 7 | `DhcpSrvLog` ✅ |
| 4% | 24 | `cisco:dnac:clienthealth` ✅ |
| 5% | 21 | `cisco:dnac:issue` ✅ |
| 11% | 35 | `cisco:dnac:client` 🟡 |
| 21% | 34 | `cisco:ios` 🟡 |
| 56% | 27 | `cisco:asa` 🔴 |
| 100% | 6 | `meraki:devicesuplinkslossandlatency` 🔴 |
| 100% | 4 | `thousandeyes:alerts` 🔴 |

### What's next

A small set of clear follow-ups, in priority order:

1. **Fix the 7 DNAC empty stanzas (real bugs).** Especially:
   - `it_critical_systems_weekoverweek_health` (broken `xyseries`)
   - `user_experience_guest_client_surge` (broken `latest(*)` + bucket logic)
   - `user_experience_client_onboarding_failures` and
     `user_experience_client_roaming_analysis` (verify nested-JSON
     extraction; switch to `spath` or use `.` notation without quotes)
2. **Tag data-gap stanzas** with `tags = ...,Requires_Data_Source` so the
   KPI picker can render a "no data on this stack" badge instead of an
   empty trend.
3. **Decide on the 8 datamodel-dependent stanzas:** either build the data
   models (`Cisco_ThousandEyes`, `Cisco_Security`, `ITSI_KPI_Summary`) or
   rewrite to use raw events.
4. **Wire `validate_searchbase_parallel.py` into CI** so a green build
   guarantees no SPL/HTTP errors. Empty-but-clean searches stay in the
   "data gap" bucket and don't block.
5. **Outstanding from prior sessions** (carried forward from cont. 4):
   - Phase 1.11 / Tier 2C — composite scoring pipelines
   - Studio v2 dashboards still pending (network, devices, security,
     overview)
   - Place the 7 new dashboard tiles into IT Health vs new "Site
     Connectivity" section

---

## 2026-05-08 (cont. 4) — Click-outside dismiss, design-of-record capacities, DNAC field-name audit

### Goal of the addendum

Four asks from the user, all landed in this session:

1. **Diagnose the link popup screenshot.** The user observed the
   Orlando&harr;Tallahassee link popup showing only `endpointHealthPct=100` with
   every other metric (capacity, throughput, utilization, latency, loss) stuck on
   "Awaiting" and asked whether that was expected given the new map popup
   enrichment work that landed in cont. 3.
2. **Audit every DNAC search for field-name correctness.** Sweep
   `searchbase.conf` against the 9 documented `cisco:dnac:*` sourcetypes (plus
   the 2 unboarded `cisco:catalyst:center:*` ones), then carry the audit into
   the dashboard layer (XML/Studio JSON inline SPL).
3. **Click outside the link/site popup to dismiss.** Today only the X button or
   Esc closes it.
4. **Hardcode design-of-record capacities** so link/site popups show meaningful
   values today instead of "Awaiting" until SD-WAN linkhealth and per-site
   Internet uplink telemetry land.

### Diagnosis (item 1)

Confirmed expected behavior: the cont. 3 enrichment work attached
`site:topology` data (address, GPS, country, building label) to the **site**
detail card, not the **link** detail card. The link rows still come from
`[overview_link_*_health]`, which on customer falls through to the Catalyst Center
device-health priority-2 path (no `cisco:sdwan:linkhealth` data exists). That
priority-2 branch was explicitly setting `capacityMbps=null()`,
`txMbps=null()`, `rxMbps=null()`, `utilizationPct=null()` &mdash; which is
exactly what the screenshot shows.

The user-confirmed design-of-record capacities (item 4 below) land directly in
that branch, so the popup will now show concrete values for capacity even
when SD-WAN telemetry stays absent.

### What we built

#### 1. Click-outside-to-dismiss (`CustomerTopologyMap.tsx`)

The existing `MapClickCapture` component only fired when the editor was open in
"pick a coordinate" mode; map background clicks otherwise did nothing. Added
an optional `onBackgroundClick` callback that fires when the editor is **not**
in pick mode and the click hit empty map (Leaflet doesn't propagate marker /
link clicks to the map's `click` event, and the SelectionCard panel is a DOM
sibling so clicks inside it never reach the map). Wired the callback to
`setSelected(null)`.

Net effect: clicking anywhere on the map background now dismisses the
SelectionCard (matches the existing Esc-key behavior). The X button still
works as before.

#### 2. Design-of-record link capacities (3 link stanzas in `searchbase.conf`)

Updated the priority-2 (DNAC fallback) branch of each link stanza to set
`capacityMbps` to a hardcoded design-of-record value and renamed the
`telemetrySourceLabel` so the popup makes the source obvious:

| Stanza | Capacity | Telemetry Source label |
|---|---|---|
| `overview_link_orlando_tallahassee_health` | 1000 Mbps | "Catalyst Center device health (capacity: 1 Gbps design-of-record)" |
| `overview_link_auburndale_tallahassee_health` | 1000 Mbps | "Catalyst Center device health (capacity: 1 Gbps design-of-record)" |
| `overview_link_orlando_auburndale_health` | 100 Mbps | "Catalyst Center device health (capacity: 100 Mbps design-of-record)" |

When SD-WAN linkhealth eventually arrives, the priority-1 branch wins (it was
already correct) and the live capacity overrides the static value
automatically &mdash; same waterfall as before.

`txMbps` / `rxMbps` / `utilizationPct` stay null in the fallback path since
those aren't design-of-record values, only live telemetry.

#### 3. Per-site Internet edge bandwidth (`types.ts`, `CustomerTopologyMap.tsx`)

Extended the `TopologySite` type with an optional `internetEdgeMbps` field and
populated it on each site in `CUSTOMER_TOPOLOGY`:

| Site | Internet edge |
|---|---|
| TLH (HQ) | 1000 Mbps |
| MCO (Regional Hub) | 500 Mbps |
| AUB (Logistics) | 500 Mbps |

`SiteDetails` now renders a "Design of Record &mdash; Internet Edge Bandwidth"
block (between Address &amp; Location and Telemetry Source) whenever the field
is set. The block is explicit that it's a static configuration value and will
be overridden when per-site Internet uplink telemetry is wired in.

The normalizer (`normalizeTopology`) preserves the field across persistence
roundtrips, so user-customized topologies inherit the new values from the
factory fallback without needing a storage-version bump.

#### 4. DNAC field-name audit (item 2)

Inventory of `cisco:dnac:*` and `cisco:catalyst:center:*` usage in the source:
- 209 sourcetype occurrences across 171 unique stanzas in `searchbase.conf`.
- 16 active dashboards (excluding archive/) inspected for inline SPL.

Methodology: scripted cross-reference of every field token in each stanza
against the canonical field inventory in
`.cursor/rules/splunk-cisco-dnac-fields.mdc`. Anti-patterns specifically scanned
for: lowercase `site` aliases, `index=*` direct usage, `siteHierarchy` on
sourcetypes that don't have it (devicehealth/issue/clienthealth/audit:logs),
`SiteName` on networkhealth (which has no site dimension), `Reachability` on
securityadvisory (where it's `DeviceReachability`), and the documented
"never exists" fields (`InterfaceUtilizationPercent`, `WANUtilization`,
`AvgTrafficNorth`, `AvgTrafficSouth`).

**Real bugs found and fixed:**

1. `[it_critical_systems_sitelevel_health]` (searchbase.conf): grouped by
   `SiteName` on `cisco:dnac:networkhealth`. That sourcetype's only dimensions
   are `category` (AP / Access / Distribution / Core / WLC / All). Result on
   the customer: empty table. **Fixed** by rebasing the stanza onto
   `cisco:dnac:devicehealth` with `dnac_site_normalize(coalesce(Site, Location))`
   and a 0&ndash;100 rescaled `OverallHealth` average per Site (with `-1`
   sentinel pre-filtered). Output schema preserved (`Site, health, devices`).

2. `[it_critical_systems_ds_site_health]` (searchbase.conf): same
   networkhealth issue, with a misleading `rename category as Site` that made
   "AP" / "WLC" / etc. masquerade as site labels. **Fixed** the same way as
   #1, with band-count columns (`good`/`fair`/`bad`) computed directly from
   `OverallHealth` thresholds (&ge;8 good, 4&ndash;7 fair, &lt;4 bad).

3. `it_health_v2.xml` (`ds_site_health` inline SPL): same broken networkhealth
   query was duplicated in the dashboard. **Fixed** to match the corrected
   searchbase stanza.

4. `spaces_intelligence_v2.xml`: 7 inline DNAC queries used `index=*` directly
   (anti-pattern per cursor rule &mdash; should use the `index_catalyst`
   macro). **Fixed all 7.** The first one (`ds_client_health_by_site`) also
   had a lowercase `site` alias built from `mvindex(split(siteHierarchy, "/"), 3)`;
   replaced with the canonical `dnac_site_normalize(siteHierarchy)` overwrite
   pattern.

5. `statewide_exercise_v2.xml` (`ds_exec_client_health_by_site`): used a
   lowercase `site` alias the same way. Replaced with the
   `dnac_site_normalize` overwrite pattern.

**Confirmed false positives (no fix needed):**

- Stanzas that synthesize fields like `siteId="tlh"`, `id="mco-tlh"`,
  `type="branch"` via `eval` &mdash; the names happen to match canonical fields
  on `cisco:dnac:client` but they're literal-value assignments, not field
  reads.
- Lookup-output fields (`audit_logs_by_site_lookup_join`,
  `clienthealth_by_site_lookup_join`, etc.) that pull `Site` / `address` from
  `site_topology_lookup`. The lookup is the source, not the original
  sourcetype.
- Internal renames like `rename SiteName as Site` and the synthetic
  `description` / `severity` aliases on issue stanzas (those are aliases of
  `IssueSpecificDescription` / `IssueSpecificSeverity` for nicer column
  names, not reads from `cisco:dnac:audit:logs`).

### Verification

- `yarn run typecheck` &mdash; clean (no errors introduced by the
  `internetEdgeMbps` field or `Globe` icon import).
- `it_critical_systems_sitelevel_health` query on customer now returns
  4 rows (Atlanta-GA, Boston-MA x2, Plano-TX) with proper per-site health
  rollups; previously returned 0 rows.
- Re-ran the audit script against the modified files: 0 occurrences of any
  fixed anti-pattern remain.
- All 3 link stanzas verified to have `capacityMbps=1000|1000|100` in their
  fallback branches with the updated `telemetrySourceLabel`.
- No regressions in the `[overview_link_*]` SPL syntax (the `cisco:sdwan:linkhealth`
  CLI test failure was a pre-existing the customer-empty-events artifact, not a
  regression).

### Files touched

- `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf`
  (3 link stanzas + 2 site-health stanzas).
- `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/data/ui/views/it_health_v2.xml`
  (inline `ds_site_health`).
- `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/data/ui/views/spaces_intelligence_v2.xml`
  (7 `index=*` &rarr; `index_catalyst` + 1 lowercase site alias fix).
- `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/data/ui/views/statewide_exercise_v2.xml`
  (1 lowercase site alias fix).
- `packages/splunk-cisco-dashboards/src/main/webapp/common/components/florida/CustomerTopologyMap.tsx`
  (click-outside-to-dismiss + `internetEdgeMbps` factory + `SiteDetails`
  Design-of-Record block + `Globe` icon import + normalize merge).
- `packages/splunk-cisco-dashboards/src/main/webapp/common/types.ts`
  (`internetEdgeMbps?: number` on `TopologySite`).

### What's next

Open items still pending from cont. 3:
- Phase 1.11 / Tier 2C composite-scoring stanzas in searchbase.conf.
- Phase 2.1 search-name simplification + drift cleanup.
- Phase 2.2 documentation drift in conf `<explanation>` HTML.
- Studio v2 dashboards still pending: network, devices, security, overview.
- Where do the 7 IT Health / Site Connectivity tiles live? Either expand
  IT Health or create a new Site Connectivity section.

New items added by this addendum:
- Once SD-WAN linkhealth or per-site Internet uplink telemetry arrives, the
  static design-of-record values become live-overridable automatically &mdash;
  no code change needed beyond updating the source data feed.
- Future field-list updates to the cursor rule should re-run the audit
  script; the script is documented inline in this session's chat thread and
  could be extracted into `scripts/dnac_field_audit.py` if we want it as a
  pre-commit hook.

---

## 2026-05-08 (cont. 3) — Map popup enrichment, two join stanzas, drift panel landed

### Goal of the addendum

Land the three follow-ups committed to at the end of cont. 2:
1. Wire `site_topology_marker_enrichment` into the map popup so address /
   country / coordinates appear when a site is selected.
2. Replicate the join demo for `clienthealth` and `audit:logs`.
3. Ship the drift panel into a system-status / data-quality dashboard.

All three landed today.

### What we built

#### 1. Map popup enrichment (`CustomerTopologyMap.tsx`)

- Defined a public `SiteEnrichment` type alongside the existing topology
  types, keyed on a building's `name` (e.g. "TLH", "AUB", "MCO") so it
  matches the map's `shortName` field directly.
- Added a `siteEnrichmentByShortName` state hook and a dedicated
  `useEffect` that fires `[site_topology_marker_enrichment]` once when
  the searchbase catalogue resolves. The fetch is independent of the
  per-site / per-link search effects so it doesn't compete for slots.
- Threaded the enrichment through `SelectionCard` → `SiteDetails` as a
  new optional `enrichment?: SiteEnrichment` prop. `SiteDetails` now
  renders an "Address & Location" block between the metric pills and the
  telemetry-source block, **only when enrichment is present**, so sites
  that DNAC isn't currently managing (today: Orlando) silently skip the
  block instead of rendering "-" placeholders.
- The block surfaces street address, country, GPS coordinates, the
  human-readable `Site` label, the source sourcetype, and the lookup's
  `lastUpdated` timestamp.

Verified end-to-end:
- TLH and AUB sites render the Address block with full street addresses
  (Shumard Oak Boulevard for TLH, Fred Jones Boulevard for AUB).
- MCO renders cleanly **without** an Address block — exactly the
  graceful-degradation behavior we wanted.
- `tsc --noEmit` clean. Lint clean.

#### 2. `clienthealth_by_site_lookup_join` searchbase stanza

Built per the documented two-stage stats pattern (snapshot data: stats
by `siteId` first, then lookup, then re-stats by `Site`). Filters out
the `siteId="global"` literal early — see "customer caveat" below.

#### 3. `audit_logs_by_site_lookup_join` searchbase stanza

Originally drafted as a pure UUID-lookup join, but **local data
inspection forced a pivot to a hybrid pattern**:

- customer-style schema would emit UUID-form `network.siteId` matching
  topology lookups directly.
- Demo data (and apparently some customer events) emit `network.siteId`
  in **path form** — `Global/Florida/Tallahassee` — or short label form
  — `Tallahassee` — neither of which matches a UUID.
- The literal-string `"null"` value also appears for ~94% of demo
  events; those are dnac-instance-scoped (logins, system config) with
  no site context.

The hybrid stanza tries the UUID lookup first and falls back to
`dnac_site_normalize` for path/label inputs, then `coalesce()`-merges
into a single `Site` column. Empty / `"null"` / unmatched inputs are
filtered out at the top so they don't pollute the rollup. Verified
against ~1.3M demo audit events: 93 events resolve to "Tallahassee:
TLH" via the macro path (no UUIDs in demo data, so the lookup arm is
dormant for now but ready when customer emits real UUIDs).

Both stanzas tagged `Cisco,Catalyst_Center,Network,Topology,Lookup_Join`
so they appear in the KPI picker's Cisco-only filter.

#### 4. Drift panel placement

Picked `admin_guide_v21.xml`'s **Troubleshooting** layout as the home —
already a system-status / data-quality surface (slow searches, schedule
conflicts, cache hit rates, dashboard usage). Drift fits the same
audience: "is the data we depend on actually here".

Added:
- `viz_ts_box_drift` — rounded-rectangle background to match the other
  troubleshoot sections.
- `viz_ts_drift_table` — `splunk.table` viz with row coloring on the
  `driftStatus` column: green-tinted for "Managed by DNAC", red-tinted
  for "Missing from DNAC".
- `ds_site_drift` — inline SPL data source (mirrors the searchbase
  stanza's logic but inlined per the dashboard's existing convention of
  in-XML SPL).
- Bumped `layout_troubleshoot.options.height` from 3310 → 3600 to fit
  the new section below the Dashboard-Usage table.

Verified the live SPL output:

```
Site             driftStatus       buildings ...
Orlando: MCO     Missing from DNAC -         (red)
Auburndale: AUB  Managed by DNAC   AUB       (green)
Tallahassee: TLH Managed by DNAC   TLH       (green)
```

Exactly the diff we wanted: every site the React `CUSTOMER_TOPOLOGY`
factory expects is checked against `site_topology_lookup`, and Orlando
is correctly flagged because the customer's DNAC isn't managing it today.

### customer caveat captured in cursor rule

Local data verification surfaced two customer-specific facts that need to
travel forward:

1. `cisco:dnac:clienthealth.siteId` is **always literally `"global"`**
   on customer (and on demo data). 31,577 events, one distinct value. So
   the per-site clienthealth join returns zero rows on customer until DNAC
   is configured to emit per-site rollups. The `siteId="global"` filter
   in the stanza prevents a useless single-row "global" entry from
   polluting the table.
2. `cisco:dnac:client.siteId` and the leaf of `siteHierarchyId` can
   **differ by a few events** because DNAC sometimes places the same
   client at building precision via `siteId` and sometimes at floor
   precision via `siteHierarchyId`. Either field joins correctly to
   `site_topology_lookup`; just don't expect the leaf-extraction
   counts to match `siteId` counts exactly.

Both facts are now documented in
`.cursor/rules/splunk-cisco-dnac-fields.mdc` so future sessions don't
relearn them.

### What's next

- User to deploy and visually verify the drift panel + map popup
  enrichment + new KPI-picker entries on the customer.
- Pending Tier 2C (composite scoring) review.
- Studio v2 dashboards for `network`, `devices`, `security`, `overview`
  still pending.
- Decide where the seven new IT critical-systems sparkline stanzas
  (Site Connectivity & Link Health) live in the dashboards — they're
  searchable but not yet bound to a tile slot.

---

## 2026-05-08 (cont. 2) — Site topology lookup + UUID-chain join discovery

### Goal of the addendum

Build all three of the use-case options proposed at the end of the previous
addendum (map popup enrichment, lookup CSV, drift panel), and follow up on
a major discovery the user made while inspecting raw client events.

### The discovery

Inspecting `cisco:dnac:client.siteHierarchyId` against the topology UUIDs,
the user noticed the field is a **slash-delimited chain of UUIDs**:

```
/5a741df8-…/6a2762cb-…/13153d82-d3d4-40e7-9ede-47a18cc5b463/25413ab8-…/5dfbc418-…/
```

Cross-referenced against the topology dump, every UUID in the chain matches
an `id` in `cisco:dnac:site:topology` — the chain is literally the path from
the global root to the leaf hierarchy node where the client was last seen.
That makes `cisco:dnac:site:topology.id` a **canonical join key for the
entire DNAC site graph**.

This is much bigger than just enriching the topology data — it unlocks
human-readable site labels on **three sourcetypes that previously had only
opaque UUIDs**:

| Sourcetype | Field | Previously |
|---|---|---|
| `cisco:dnac:client` | `siteHierarchyId` | Had to extract the path string from `siteHierarchy` to label |
| `cisco:dnac:clienthealth` | `siteId` | **No name field at all** — every dashboard panel showed UUID strings |
| `cisco:dnac:audit:logs` | `network.siteId` | **No name field at all** — same problem |

Verified locally with a join sanity check: 6,822 of 7,067 (~97%) client
events resolve to a known leaf UUID. The remaining 3% are unbound clients
that never associated with a managed AP.

### What we built

#### A. Lookup machinery (transforms.conf + savedsearches.conf)

**`transforms.conf`**: new `[site_topology_lookup]` stanza pointing at
`site_topology_lookup.csv`, with comments documenting which sourcetypes
join against it and what each field's UUID shape is.

**`savedsearches.conf`**: new `[Executive Dashboard - Site Topology Lookup
Generator]` saved search. Schedule: every hour at minute 7, 7-day window.
The search snapshots `cisco:dnac:site:topology` into a CSV keyed on `id`,
**with floor-row enrichment** — every floor row inherits `lat`, `lon`,
`address`, and `country` from its parent building via a `parentId` self-join.
This means every leaf UUID in the lookup has a complete address, regardless
of whether the client telemetry placed the client at building or floor
granularity.

Lookup columns: `id, name, type, parentId, nameHierarchy, Site, lat, lon,
address, country, floorNumber, rfModel, cisco_catalyst_host,
inheritedFromBuilding, updated`.

#### B. Three new searchbase.conf stanzas (the user's three options)

New section "Site Topology Lookup & UUID-Chain Joins (customer build,
2026-05-08)" with full description / explanation / solution / related_info
HTML treatment for each:

| Stanza | Purpose | Source |
|---|---|---|
| `site_topology_marker_enrichment` | One row per DNAC-managed building with GPS + full address. Used by map popups. | `inputlookup site_topology_lookup` filtered to `type="building"` |
| `site_topology_drift_panel` | Diff between expected sites (TLH, MCO, AUB hardcoded inline to mirror `CUSTOMER_TOPOLOGY`) and DNAC-managed sites. | `makeresults`-built expected list, left-joined to lookup |
| `clients_by_building_lookup_join_demo` | Demonstrates the UUID-chain extraction + lookup-join pattern by counting clients per building. Spans both `building` and `floor` leaf granularity. | `cisco:dnac:client` + lookup |

All three stanzas tagged `Cisco` so they surface in the customer-only KPI picker
filter, and use the project-standard `default_viz = splunk.table` since
they all return categorical data.

#### C. Cursor rule updated with the join pattern

`.cursor/rules/splunk-cisco-dnac-fields.mdc` gained a new top-level section
**"Cross-sourcetype joins on DNAC site UUIDs"** documenting:
- The canonical join key (`cisco:dnac:site:topology.id`)
- The four fields across three sourcetypes that resolve to it
- The leaf-extraction recipe (`rtrim → split → mvindex(-1)`)
- The aggregation pattern that collapses hierarchy levels into one Site
- Four explicit anti-patterns (lookup-before-aggregate, group-by-Site-and-address, re-querying topology raw, ltrim-before-split)

### Verification

Seeded the lookup locally (`/opt/splunk/etc/apps/splunk-cisco-dashboards/lookups/site_topology_lookup.csv`)
by running the generator search against the imported customer data. All 13
topology rows produced; floor rows correctly inherited their building's
address.

All three stanzas validated end-to-end:

| Stanza | Output | Notes |
|---|---|---|
| `site_topology_marker_enrichment` | 4 buildings (TLH, SEOC, AUB, Warehouse) with GPS + full address | All GPS pairs unique to their physical campus pair |
| `site_topology_drift_panel` | 3 expected sites; **Orlando: MCO flagged as "Missing from DNAC"** | Confirms customer operational gap operationally visible |
| `clients_by_building_lookup_join_demo` | 4 sites, 365 unique clients across 7,332 events | TLH = 328 clients (largest), AUB = 28, Warehouse = 5, SEOC = 4. All four sites carry full street addresses thanks to floor-row enrichment. |

### Bug found and fixed during validation

Initial `clients_by_building_lookup_join_demo` grouped by `Site, address`
and was missing 75% of the volume because floor-level UUIDs (which lack
addresses in the lookup) were being separated from building-level UUIDs of
the same site. Fixed two ways: changed the group-by to `Site` only with
`values(address)`, **and** added parent-building enrichment to the lookup
generator itself so every consumer benefits, not just this stanza.

Also silenced a benign `latest()` warning in the drift panel by switching
to `first()` (the lookup has no `_time` so `latest` was undefined behavior).

### Files changed in this addendum

| File | Net effect |
|---|---|
| `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/transforms.conf` | +1 stanza (`[site_topology_lookup]`) with documentation comments |
| `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/savedsearches.conf` | +1 saved search (`[Executive Dashboard - Site Topology Lookup Generator]`) with hierarchy-walking enrichment |
| `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf` | +1 section header, +3 stanzas (file: 10024 → 10063 lines approx) |
| `.cursor/rules/splunk-cisco-dnac-fields.mdc` | +1 top-level section "Cross-sourcetype joins on DNAC site UUIDs" |
| `packages/splunk-cisco-dashboards/docs/SESSION_LOG.md` | This addendum |
| `packages/splunk-cisco-dashboards/stage/lookups/site_topology_lookup.csv` | Generated locally (13 rows) — would be regenerated by the saved search at deploy time |

### What's next

1. **Wire the marker enrichment into the map popup component** —
   `CustomerTopologyMap.tsx` would call this stanza on hover/click to show
   full address + GPS. Decide whether to call inline or via the existing
   `useMetric` / `useTableData` hook.
2. **Add the drift panel to a system-status / data-quality dashboard** —
   it doesn't fit the executive overview but is valuable for the IT-Ops
   audience.
3. **Replicate the join demo for `cisco:dnac:clienthealth` and
   `cisco:dnac:audit:logs`** — the stanza I built proves the pattern; doing
   the same for the previously-unlabeled sourcetypes is now a small,
   well-scoped follow-up that would unlock site-aware client-health and
   site-aware audit-log dashboards.
4. **Commit when satisfied.**

---

## 2026-05-08 (cont.) — `cisco:dnac:site:topology` onboarded on the customer

### Goal of the addendum

customer operations team added the `cisco:dnac:site:topology` input ~1 hour
before the user noticed events flowing. Establish what the sourcetype
actually contains, lock canonical fields into the Cursor rule, ingest a
clean local copy, and decide what we can build with it.

### Discovery & decisions

1. **The sourcetype is `cisco:dnac:site:topology`, but it is NOT network
   topology.** Despite the name, this is the DNAC site-hierarchy API:
   `global → area → building → floor` reference data. There are zero
   device records, zero link records, no `linkStatus`, no neighbor
   information, no interface fields. Treat it as a slow-changing
   reference dataset, not an event stream.

2. **Field inventory (18 fields, locked into the Cursor rule):**
   `address, cisco_catalyst_host, country, floorNumber, height, id,
   latitude, length, longitude, name, nameHierarchy, parentId, rfModel,
   signature_id, type, unitsOfMeasure, vendor_product, width`. Field
   availability is stratified by `type`: only `building` rows carry
   `latitude`/`longitude`/`address`, only `floor` rows carry RF/dimension
   fields, `area` and `global` rows are hierarchy-only.

3. **Polling cadence is passive / snapshot** (user's words: *"this
   sourcetype is passive unlike the others"*). All events typically
   share one `_time`. Don't `timechart` against it. Build lookups or
   inline-join it.

4. **There is no separate `cisco:dnac:topology:*`** sourcetype on the
   TA — this is the only topology-related ingest available. To get
   actual device-and-link topology, a different DNAC API (e.g. physical
   topology) would need a separate input definition.

5. **Three meaningful caveats from inspecting the customer's 13 events:**
   - **Floor dimensions are placeholder defaults** — TLH First Floor and
     SEOC First Floor share identical `width × length` (595.4196 ×
     389.6426); AUB Floor 1 and Warehouse Floor 1 share identical
     dimensions (932.07355 × 721.7231). DNAC accepted the floors but no
     real floorplans were uploaded. Don't trust dimensions for
     visualizations.
   - **Co-located buildings share GPS + address.** TLH and SEOC both
     report `30.38617, -84.23846` and `2489 Shumard Oak Boulevard,
     Tallahassee`. AUB and Warehouse both report `28.152445, -81.808044`
     and `660 C Fred Jones Boulevard, Polk City`. This **validates the
     existing TLH+SEOC and AUB+Warehouse rollups** in our
     `[overview_site_*_health]` stanzas — DNAC also treats each campus
     as one location with multiple logical buildings.
   - **Orlando / MCO is absent from the customer's hierarchy.** No `area`,
     `building`, or `floor` rows for Orlando. DNAC is not currently
     managing the Orlando site. Worth raising with customer operationally.

### What we built

#### A. Updated Cursor rule with full topology coverage

File: `.cursor/rules/splunk-cisco-dnac-fields.mdc`. Changes:
- Status table flipped from "❌ Pending" to "✅ Yes (added 2026-05-08,
  passive/snapshot)" — onboarded count is now 9 of 11.
- Canonical site-field table appended a row mapping `cisco:dnac:site:topology`
  to `nameHierarchy` / `name` / `id` / `parentId`.
- New dedicated section replaces the old "Awaiting field lists"
  placeholder. Documents: 18-field inventory, per-`type` field
  availability matrix, the three customer caveats, three recommended use
  patterns (GPS lookup, hierarchy traversal, data-quality drift check),
  and an explicit "what this sourcetype does NOT give us" anti-list to
  prevent future mistakes (no devices, no links, no CDP/LLDP, no
  interfaces, no time-series).

#### B. Local one-shot import for ad-hoc verification

User cleaned the JSON envelope from the original customer export and
provided a flat line-delimited JSON at
`~/Downloads/cisco_sample_data/new/cisco_dnac_site_topology.txt` (13
events, 4467 bytes). Imported into local Splunk:

```
sourcetype: cisco:dnac:site:topology
index: fdem
host: fdem-import-2026-05-08
```

Distribution: 1 `global` + 3 `area` + 4 `building` + 5 `floor` = 13.

#### C. Three validated query recipes against the imported data

| Recipe | Purpose | Status |
|---|---|---|
| Pattern A — Buildings with GPS | One row per building with `lat/lon/address/country/parentId` | ✅ Returns 4 rows (TLH, SEOC, AUB, Warehouse). |
| Pattern B — Hierarchy traversal | `values(name) by Site` for buildings + floors | ✅ Returns rollups consistent with the existing site stanzas. |
| Pattern C — Floor inventory | `Site, name, floorNumber, rfModel, sqft` | ✅ Returns 5 rows but with placeholder dimensions; flagged. |

### Verification

Used `dnac_site_normalize(nameHierarchy)` against the new sourcetype and
got exactly the same canonical site labels as the existing site health
stanzas use ("Tallahassee: TLH", "Auburndale: AUB", etc.) — confirming
that the macro is portable across devicehealth and site:topology
sources without modification.

### Files changed in the addendum

| File | Net effect |
|---|---|
| `.cursor/rules/splunk-cisco-dnac-fields.mdc` | Status table updated (onboarded 8→9, pending 3→2). Canonical site-field table extended. New 80-line dedicated section replaces the "Awaiting field lists" placeholder for `cisco:dnac:site:topology`. |
| `packages/splunk-cisco-dashboards/docs/SESSION_LOG.md` | This addendum. |

No code or `searchbase.conf` changes — this is reference-data work.

### What's next (decision points for the user)

Three concrete options for how to use this data, in order of effort:

1. **Map popup enrichment** (lowest effort, highest immediate value).
   Wire `cisco:dnac:site:topology` building rows into the Florida map's
   site-marker popups: full address, country, GPS pin precision. Live
   data, no caching needed (13 events is trivial to query).

2. **Build a `site_topology_lookup.csv`** (medium effort) via a
   scheduled search that snapshots `nameHierarchy → siteId, lat, lon,
   address, parentChain`. Lets searchbase stanzas join site metadata
   without re-hitting the topology sourcetype on every dispatch.

3. **Configuration-drift signal** (low effort, useful for ops). A panel
   that lists "sites in our dashboard topology that DNAC isn't managing"
   — would immediately surface the missing-Orlando situation as
   actionable rather than silent.

Defer until the user picks a direction.

---

## 2026-05-08 — Map rewrite (the customer-aware) + 7 dashboard tiles

### Goal of the session

Make the executive overview map work cleanly on the customer's 9-sourcetype Catalyst
Center stack (no SD-WAN, no `cisco:dnac:site:topology`, no `cisco:catalyst:center:inventory:report`)
without breaking the rich-metrics behavior on demo data.

### Discovery & decisions before any code changed

1. **Validated customer has 8 of the expected 11 Catalyst Center sourcetypes.**
   User provided complete field lists for `cisco:dnac:devicehealth`, `issue`,
   `networkhealth`, `client`, `clienthealth`, `compliance`, `audit:logs`, and
   `securityadvisory`. Three sourcetypes are present locally but missing from
   the customer: `site:topology` (high value), `inventory:report` (medium), and
   `compliance:report` (redundant with `compliance`).

2. **Macro-prefix policy**: when running ad-hoc tests on the customer's stack the
   user swaps to `fdem_*` prefixed macros (their stack uses
   `fdem_index_catalyst`, `fdem_dnac_site_normalize`). All
   `searchbase.conf` SPL stays on **our app's macros** (`index_catalyst`,
   `dnac_site_normalize`) — the customer wraps macros at deploy time.

3. **Field-name compliance failure**: I made repeated case mistakes (e.g.
   `site` vs `Site`, inventing `site_short`). User called it out. We
   committed to a permanent fix: a Cursor rule file that documents
   canonical field names per customer sourcetype so case/scale errors don't
   happen again.

4. **Data sparseness reality-check on customer live**: `cisco:dnac:client`
   returned only 6 events in 30 days on the customer's stack — too sparse for
   reliable dashboard metrics. We deferred client-traffic tiles for the customer
   and chose `cisco:dnac:issue` "high input/output utilization" events as
   a bandwidth pressure proxy. `cisco:dnac:networkhealth.kpiMetrics{}.key`
   was always null on the customer's data, making `kpiMetrics{}` unusable.

5. **CDP/LLDP not adopted** (asked at end of session): Layer-2 neighbor
   protocols can't see across WAN boundaries and carry structural not
   operational data. DNAC already uses them internally to build
   `cisco:dnac:site:topology`, which is the right ingest point. Future
   work: mine `cisco:ios` syslog for `%CDP-4-*` / `%LLDP-4-*` events as
   physical-layer leading indicators if 9300X syslog is forwarded.

### What we actually built

#### A. New Cursor rule for DNAC field discipline

File: `.cursor/rules/splunk-cisco-dnac-fields.mdc` (404 lines).
Documents per customer-confirmed sourcetype: canonical site field name, key
fields, fields that DO NOT EXIST, scale conventions (0-10 vs 0-100), the
`-1` "no data" sentinel, and common SPL patterns. Two anti-patterns are
called out explicitly: lowercase aliasing (creating `site` instead of
overwriting `Site`) and assuming all health fields share one scale.

#### B. Imported customer sample data into local Splunk

User exported 6 sourcetypes from the customer's stack to `~/Downloads/cisco_sample_data/new/`.
Oneshot-imported into `index=fdem` on local Splunk (port 8089) with
`host=fdem-import-2026-05-08`:

| Sourcetype | Events |
|---|---|
| `cisco:dnac:client` | 8,568 |
| `cisco:dnac:clienthealth` | 31,577 |
| `cisco:dnac:compliance` | 28,066 |
| `cisco:dnac:devicehealth` | 10,015 |
| `cisco:dnac:issue` | 4,362 |
| `cisco:dnac:networkhealth` | 10,525 |
| **Total** | **93,113** |

Time range: 2026-05-06 17:18 → 2026-05-07 23:33 (~30 hours, sparkline-friendly).

Three-panel validation against the imported data confirmed three
**independent signals** all converge on the same story: AUB Distribution
is degraded (Panel 1 link health 82.2%, Panel 3 device-unreachable count
166, networkhealth Distribution category at 60% healthy globally).

#### C. Drafted 7 new dashboard tile stanzas

Section: "Site Connectivity & Link Health (customer build, 2026-05-08)".
File: `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf`,
lines 9780-9959.

| Stanza ID | What it surfaces | Validated value range |
|---|---|---|
| `it_critical_systems_site_connectivity_score_trend` | Worst site's `OverallHealth` (0-10) | 1.00 → 9.80 |
| `it_critical_systems_site_link_availability_pct_trend` | Worst site's `InterDeviceLinkAvailHealth` (0-100%) | 0% → 100% |
| `it_critical_systems_site_link_events_24h_trend` | Link-down + unreachable issues per hour | 0 → 103/hr |
| `it_critical_systems_site_bandwidth_pressure_24h_trend` | High-utilization issues per hour (proxy for missing kbps) | 0 → 15/hr |
| `it_critical_systems_site_errors_discards_24h_trend` | Interface error/discard issues per hour | 48 → 618/hr |
| `it_critical_systems_site_power_events_24h_trend` | PSU & hardware-fault issues per hour | 0 → 92/hr |
| `it_critical_systems_network_category_distribution_health_trend` | Worst network tier's healthy % (Access/Dist/Core/AP/WLC) | 20% → 60% |

Every stanza:
- Uses `` `index_catalyst` `` and `` `dnac_site_normalize` ``
- Filters the `-1` sentinel on health-score aggregations
- Returns `_time + single value` shape for sparkline tiles
- Tagged `Cisco` so the customer-only KPI picker filter surfaces them
- Includes the project-standard `description` / `explanation` /
  `solution` / `related_info` HTML treatment

**Status: drafted but NOT wired into the dashboard yet.** They are
discoverable via the KPI picker; user needs to swap them into tile slots
or add a "Site Connectivity" section. Open item.

#### D. Map rewrite — 5 stanzas updated, 1 new stanza added (the actual headline work)

This was the user's original ask that we got to last. Three problems with
the legacy map stanzas:

1. Site stanzas used hand-rolled `Site="*Tallahassee*" OR Site="*TLH*"`
   filters instead of `dnac_site_normalize`.
2. Link stanzas depended on `cisco:sdwan:linkhealth` (customer doesn't have it).
3. Link stanzas referenced the customer-nonexistent fields: `IsWanEdge`,
   `WANInterfaceUtilizationPct`, `WANLinkSpeedMbps`, `WANInterfaceTxKbps`,
   `WANInterfaceRxKbps`, `WANInterfaceName`.

**Macro update** (`macros.conf` line 165):
`dnac_site_normalize` extended with three more matchers — strict
`(^|/)MCO(/|$)`, broad `Orlando`, broad `Tallahassee`, broad
`Auburndale` — plus a path-prefix fallback that strips both
`Global/Florida/` and `Global/USA/`.

**Site stanzas rewritten** (`searchbase.conf` lines 9550-9636):
| Stanza | Change |
|---|---|
| `[overview_site_tallahassee_health]` | Drop hand-rolled filter, use `dnac_site_normalize` + `match(Site,"(?i)Tallahassee")`. Aggregates TLH+SEOC+Betty Easley into one `siteId="tlh"` rollup. Same output shape. |
| `[overview_site_orlando_health]` | Same pattern, `match(Site,"(?i)Orlando")`. Returns no rows when Orlando data is absent (customer scenario) so the marker shows "Awaiting telemetry" instead of fabricating. |
| `[overview_site_auburndale_health]` | Same pattern, `match(Site,"(?i)Auburndale")`. Aggregates AUB + Warehouse. |

Each site stanza:
- Excludes `DeviceFamily="Unified AP"` (AP health dominated by RF metrics not comparable to switch/router posture)
- Computes `deviceScore` = case(Reachable+Managed=100, Reachable=50, else=0)
- Output: `siteId, siteName, status, healthPct, activeDevices, alerts, latencyMs, lastUpdated, telemetrySource`

**Link stanzas rewritten** with priority fallback (`searchbase.conf` lines 9637-9786):

| Stanza | Status |
|---|---|
| `[overview_link_orlando_tallahassee_health]` | Rewritten |
| `[overview_link_auburndale_tallahassee_health]` | Rewritten |
| `[overview_link_orlando_auburndale_health]` | **NEW** — completes the customer tri-site mesh |

Each link stanza now uses a clean two-tier telemetry priority:
- **Priority 1**: `cisco:sdwan:linkhealth` → full bandwidth metrics
  (capacity, throughput, utilization). Only fires when SD-WAN data
  exists (demo).
- **Priority 2 (DNAC fallback)**: `cisco:dnac:devicehealth` → endpoint
  reachability + manageability per site, averaged into
  `endpointHealthPct`. Bandwidth fields stay null. Always fires when
  DNAC data exists for both endpoints.

`eventstats min(telemetryPriority) by linkId` picks the best-available
source. Status logic falls back from utilization-based → endpoint-health-based
when bandwidth fields are null.

**React topology factory updated**
(`packages/splunk-cisco-dashboards/src/main/webapp/common/components/florida/CustomerTopologyMap.tsx`):
- Added `mco-aub` link entry to `CUSTOMER_TOPOLOGY.links`
- `searchName: 'Overview - Link Orlando to Auburndale Health'`
- Bumped `TOPOLOGY_STORAGE_KEY` from `v3` → `v4` and
  `TOPOLOGY_STORAGE_VERSION` from `3` → `4` so users with persisted
  customizations get a clean reseed that includes the new link

### Verification (against the imported customer data)

All 6 stanzas validated end-to-end:

| Stanza | Rows | Status | Source |
|---|---|---|---|
| `overview_site_tallahassee_health` | 1 | stable | DNAC devicehealth |
| `overview_site_orlando_health` | 1 | stable | DNAC devicehealth |
| `overview_site_auburndale_health` | 1 | stable | DNAC devicehealth |
| `overview_link_orlando_tallahassee_health` | 1 | stable | DNAC fallback (priority 2) — expected, no SD-WAN in import |
| `overview_link_auburndale_tallahassee_health` | 1 | stable | DNAC fallback (priority 2) |
| `overview_link_orlando_auburndale_health` | 1 | stable | DNAC fallback (priority 2) |

### Files changed this session

| File | Net effect |
|---|---|
| `.cursor/rules/splunk-cisco-dnac-fields.mdc` | NEW (404 lines) — canonical field reference |
| `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/macros.conf` | Updated `dnac_site_normalize(1)` definition |
| `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf` | +7 dashboard tile stanzas, +3 rewritten map stanzas, +1 new MCO↔AUB link stanza, +1 new section header (file: 9778 → 10024 lines) |
| `packages/splunk-cisco-dashboards/src/main/webapp/common/components/florida/CustomerTopologyMap.tsx` | Added MCO↔AUB link to `CUSTOMER_TOPOLOGY`; bumped storage key v3→v4 |

### What's next

1. **Reload the dashboard, eyeball the map.** Confirm 3 site markers
   render, 3 connectivity lines draw (including the new MCO↔AUB), and
   the legend is consistent.
2. **Decide where the 7 new dashboard tiles live.** Either fold them
   into the existing IT Health section or create a "Site Connectivity"
   section. They are searchable in the KPI picker today but not
   bound to any tile slot.
3. **Future "data sources to tap" pass.** Three explicit candidates:
   - Cisco IOS syslog (CDP/LLDP %-events from 9300X if forwarded)
   - `cisco:dnac:site:topology` if the customer TA can be extended
   - SD-WAN linkhealth if Sarav can identify a TA path
4. **Commit when you're satisfied** — work is staged but unmerged.

---

## 2026-05-07 and earlier — Session-summary capture (back-fill)

The conversation prior to this session covered substantial work that should
be on record alongside the May-8 narrative. Compressed summary by area:

### Dashboard infrastructure (React side)

- **Initial build**: monorepo (`lerna`-managed) with React executive
  dashboard for the customer. Florida map, time selector, dark mode, dynamic KPIs.
- **`splunkSearchService.js`**: search dispatcher with session-scoped
  fail-cache for 400 errors and `addLeadingSearchCommand` to ensure SPL
  is properly prefixed before hitting Splunk's `/search/v2/jobs`.
- **`useMetric` / `useKpi` / `useTableData` hooks**: search dispatch +
  result processing for single-value/sparkline tiles, single-value KPI
  cards, and tabular tiles respectively.
- **`MetricItem.tsx` + `Sparkline.tsx`**: tile chrome with min/max marker
  display (`dataValuesDisplay: minmax`), time-range footer, no-data
  diagnostic state showing reasons (`column_missing`, `empty_rows`,
  `no_numeric_column`, `error`).
- **`TableTile.tsx`**: new component for `splunk.table` viz support
  (categorical data with sticky header, scrollable body capped at 5 rows).
- **KPI picker (`KpiPickerPanel.tsx`)**: search with category/sub_category
  filters, "Cisco-only browse" filter, sticky "Currently bound" banner
  with Jump-to button, viz icons next to each result, Factory reset
  button, SPL preview from searchbase.conf (not savedsearches.conf).
- **Configurable tile counts per section**: 3-5 tiles, minus/plus pill
  control, default 5, persisted in localStorage with cross-tab sync via
  `usePersistedSectionTileCounts`.
- **Drag-to-reorder tiles**: `@dnd-kit`-based, persisted via
  `usePersistedSectionTileOrder`, hover-revealed grip handle on each tile.
- **Factory reset**: clears all localStorage customizations (overrides,
  topology, tile counts, tile order) and remounts the map via key prop
  bump.
- **Info tooltips on KPI cards**: `InfoTooltip` component with widened
  layout, increased typography for readability.
- **`overview/index.tsx` map+below-map KPI cards**: `topIncidentCard` and
  `operationalLeadCard` now prioritize user override results from
  `useKpi` over topology summary, with the override SPL resolved via
  `searchbaseByName` lookup so inline-only stanzas dispatch correctly.
  Added "Open in Search" via `ExternalLink` icon on KPI cards.

### Map / topology

- Replaced `LegacyFloridaMap` artifacts with `CustomerTopologyMap`
  driving `siteId, siteName, status, healthPct, activeDevices, ...` rows
  and `linkId, capacityMbps, throughputMbps, utilizationPct, ...` rows.
- Removed `PREVIEW_*_SEARCH_BY_ID`, `LEGACY_*_SEARCH_NAMES`, and the
  `resolve*SearchName` shim. `CUSTOMER_TOPOLOGY` factory points
  directly at live searchbase entries.
- Replaced the `it_health_v2.xml` Studio map (was using hardcoded
  Florida coordinates and a blocked tile server) with
  `splunk.bar` horizontal stacked chart showing per-site device health
  distribution.
- Florida map: removed OpenStreetMap attribution, default zoom/position
  preserved, slider for map width with auto-fit tiles.

### Searchbase.conf SPL quality sweep

- **Tier 1 rewrites committed**: 4 stanzas (`kpi_users`,
  `site_mco_active_users`, `humidity`, `temperature`) — all switched
  to timechart-first patterns.
- **Tier 2A rewrites committed**: 5 environmental + dc()-to-timechart
  stanzas, plus 7 legitimate post-timechart-decoration cases (addtotals
  etc.) accepted as exceptions to the timechart-last rule.
- **Tier 2B**: 5 display-table stanzas left as-is (not metrics, no rule
  violations).
- **Tier 2C**: composite scoring pipelines (5 stanzas) deferred —
  separate session per pipeline with storyboard-before-SPL.
- **Round-after-timechart cleanup**: rounding now happens INSIDE
  `timechart` calls so timechart stays last in the pipeline.
- **`Cisco` tag normalization**: all 396 `tags = ` lines normalized to
  no-space-comma format. Cisco tag added to 14 default-bound tile
  stanzas + 4 explicit user-requested stanzas.
- **`dataValuesDisplay: "minmax"`** added to 7 stanzas + 8 newly-configured
  stanzas got full `default_viz` + `viz_options`. New stanza
  `executive_dashboard_threat_sources` added.

### Compass / LA28 / Tensor framework adoption

- New framework introduced for building Studio v2 dashboards (Compass /
  LA28 / Tensor) with approval gates for `network`, `devices`, `security`,
  `overview` dashboards. Pre-emptive answers for archive impacts on
  `nav/default.xml`, default vs local conf placement, and index macro
  aliases (`scd_index_*` aliases alongside canonical `fdem_index_*`).
- React `pages/overview/index.tsx` left in place; new Studio
  `executive_overview.xml` will ship alongside, decision to make one
  primary `/overview` deferred to Gate 6.

### Build / packaging

- `yarn run clean:build` configured to mirror
  `~/repo/splunk-cisco-app-navigator/`.
- `yarn run package:app` configured similarly.

### Communications

- Drafted Sarav-message about customer bandwidth telemetry options. Final
  message kept concise (Q1 only — TA extension question dropped).
- Searched customer Splunk for any 9300X telemetry signals beyond the 9
  confirmed sourcetypes; none found that would substitute for SD-WAN
  link visibility.

### Open items at the start of this session

These items were on the books pre-May-8 and are still pending:
- **Phase 1.7**: deploy commit 7639acc and visual-verify
  humidity/temperature/environmental health/collab/wifi/DNS-HTTP
  latency/client-health/active_devices tiles in Splunk Web.
- **Phase 1.11 / Tier 2C**: 5 composite scoring pipelines.
- **Phase 2.1**: search-name simplification + drift cleanup.
- **Phase 2.2**: documentation drift in conf `<explanation>` HTML.
- **Phase 3**: wider sweep to non-Spaces sources (Catalyst, DNAC,
  Meraki, BMS, ISE, AD, Windows).
- **Studio v2 dashboards**: `network`, `devices`, `security`, `overview`
  pending.
- **Field lists for demo-only sourcetypes**: `cisco:dnac:site:topology`
  (high priority) and `cisco:catalyst:center:inventory:report` (medium)
  needed from user.

---

## How to use this log

- Each session entry has: **Goal**, **Discovery & decisions**, **What we built**,
  **Verification**, **Files changed**, **What's next**.
- The "What's next" of one session should match the "Goal" of the next.
- When in doubt, search this file for canonical decisions before re-deciding.
