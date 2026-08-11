# SUI 5.13 and Cisco Cloud Control alignment

## Assessment

The Insights Workspace is substantially aligned with the available Splunk UI
5.13 foundations and is compatible with a Cisco Cloud Control content surface.
It is not yet a formal design-system certification. The application deliberately
keeps Splunk Enterprise global chrome as the authoritative shell and aligns the
workspace inside that shell instead of duplicating the Cisco Cloud Control
header, navigation, or account controls.

This review used the supplied SUI 5.13, Themes 1.10, and Icons Figma libraries,
the packages installed in this repository, and the current rendered workspace.
The configured npm registry was checked on 2026-08-06 and confirmed that
`@splunk/react-ui` 5.13.0, `@splunk/react-icons` 5.14.0, `@splunk/themes`
1.10.0, `@splunk/visualizations` 28.8.0, `@splunk/visualizations-shared`
28.8.0, and `@splunk/dashboard` 29.8.0 are the current `latest` releases
available to this project.
The VPN-only internal documentation site was unavailable during the final pass,
so any internal-only 1CD guidance should receive one follow-up review when VPN
access is available.

## Direct Figma evidence

- The supplied SUI file exposes a `🧾 Changelog v5.13` page and dedicated
  component pages for `Select`, `Modal`, `Table`, `Button`, and the other
  controls used by this workspace.
- The inspected SUI `Select` default is a 28 px-high, 4 px-radius control using
  the interactive-border, active-content, body-font, and small-spacing tokens.
  The workspace uses the actual SUI React `Select` and intentionally narrows the
  time-range and refresh instances to protect the command title.
- The inspected `.Modal / Material` `type=glass` variant supplies the exact
  high-glass border, corner/tint gradients, inner highlight, blur, and layered
  modal shadows now used by `WorkspaceModalShell`.
- The supplied Icons file includes a dedicated Workspace category with 16 px
  and 24 px variants. The workspace switcher therefore uses Splunk's layered
  workspace metaphor rather than a person glyph; the topology control uses the
  Splunk globe glyph.

## Version baseline

| Foundation | Version | Status |
| --- | ---: | --- |
| `@splunk/react-ui` | 5.13.0 | Matches the requested SUI release |
| `@splunk/react-icons` | 5.14.0 | Compatible icon package; newer patch baseline |
| `@splunk/themes` | 1.10.0 | Matches the supplied Themes library |
| `@splunk/visualizations` | 28.8.0 | Native renderer used for composition charts |
| `@splunk/visualizations-shared` | 28.8.0 | Native visualization support |
| `@splunk/dashboard*` | 29.8.0 | Dashboard Studio framework baseline |

## Alignment matrix

| Area | Result | Evidence and decision |
| --- | --- | --- |
| Theme | Aligned | Light, dark, and system modes use the installed Splunk theme foundation. The dark workspace remains a product surface, not a replacement for Splunk global chrome. |
| Typography and hierarchy | Aligned with exceptions | Titles, subtitles, labels, status, and tabular values have consistent hierarchy. Dense operational tiles retain compact custom typography where a general-purpose SUI layout would cost too much information density. |
| Controls | Substantially aligned | Primary header selectors use SUI `Select`; the theme action uses SUI `Button`. Canvas and tile-editing interactions remain purpose-built where no equivalent SUI control preserves the required spatial behavior. |
| Icons | Aligned | Product icons resolve through `@splunk/react-icons`, primarily via the shared `SuiIcon` adapter. Icons carry labels or tooltips when the meaning is not visible in adjacent text. |
| Modals | Aligned | The shared modal shell uses the SUI 5.13 `.Modal / Material` `type=glass` surface: 4 px radius, 18% high-glass border, the 45% → 25% tint gradient, 75 px CSS backdrop blur, inner highlight, and the supplied four-layer modal shadow stack. It also includes a readable page backdrop, focus trap and restoration, Escape handling, responsive bottom-sheet behavior, and accessible width/height/corner resizing. |
| Visualizations | Aligned with deliberate custom views | Composition tiles use lazy-loaded native Splunk ranked bars. Time-series microcharts and the command topology remain custom because they are compact operational controls, not standard full-size dashboard charts. |
| Status semantics | Aligned | Healthy, warning, and critical states use consistent text plus color; state is not communicated by color alone. |
| Cisco Cloud Control relationship | Compatible | The workspace uses a compact content toolbar and command-center composition while leaving Cisco/Splunk global shell responsibilities outside the application surface. |
| Responsive behavior | Aligned | Header controls preserve the workspace title, H1 is a real compact layout, sections wrap by available width, and modal content adapts to mobile. |
| Performance | Guarded | Optional native visualization code is lazy-loaded and JavaScript bundles have measured, explicit regression budgets appropriate for unminified Splunk watch builds. |

## Cisco Cloud Control fit

Public Cisco guidance describes Cloud Control as one operational environment
with persistent global navigation, unified inventory and topology, and product
experiences that retain autonomy inside a federated shell. That supports the
following boundary for this Splunk application:

- Splunk Enterprise continues to own global navigation, user identity, app
  switching, notifications, and help while the application is running in
  Splunk.
- The application owns the cross-domain command workspace: concise health and
  risk signals, topology relationships, time scope, progressive drill-down,
  and human-reviewed actions.
- The application does not imitate or stack a second C3 global header inside
  Splunk. If it is later hosted as a C3 micro frontend, the surrounding C3
  shell should replace Splunk chrome while this content surface remains.
- Edit and administrative affordances must respect both Splunk permissions and
  any future C3/product-level RBAC contract; read-only users should not receive
  controls they cannot execute.

Authoritative public references:

- [Cisco Cloud Control Getting Started](https://www.cisco.com/c/en/us/td/docs/ai/cisco-cloud-control/articles/cisco-cloud-control-getting-started.html)
- [Cisco Cloud Control Role-Based Access Control](https://www.cisco.com/c/en/us/td/docs/ai/cisco-cloud-control/articles/cisco-cloud-control-rbac.html)
- [Inside Cisco Cloud Control: platform architecture](https://blogs.cisco.com/ai/inside-cisco-cloud-control-building-the-ai-native-platform-of-record-for-cross-domain-operations)

## Remaining review items

1. Re-open the VPN-only Splunk UI documentation and compare any unpublished
   1CD composition rules with the content toolbar and workspace picker.
2. Continue replacing ordinary form controls with SUI components when touching
   those areas. Do not mechanically replace spatial canvas controls whose custom
   hit areas, drag behavior, or compact density are part of the interaction.
3. Run an accessibility pass with keyboard-only navigation and a screen reader
   after the final search configuration is installed.
4. Treat formal C3 approval as a design-team review, not something inferred from
   package versions alone.

## Agreed implementation backlog

These items record approved design intent for later implementation. They are
not claims about the current product behavior.

### Signal trail motion controls

- Default the signal trail to motionless.
- Let the user enable motion explicitly and control its speed within a bounded
  supported range, initially `0.25x` through `2x`.
- Keep trail direction, status, and meaning fully understandable in the static
  state; motion must never be the only signal.
- Remember the user's selected speed, but keep the preference private,
  workspace-scoped, and reversible. Disabling motion should preserve the last
  selected speed for the next time it is enabled.
- Respect the operating system or browser reduced-motion preference.
- Apply the 1CD Sheen treatment only to paths that communicate real activity;
  do not animate the trail as permanent ambient decoration.
- Allow a demo operator to enable the trail and tune its speed for presentation
  without changing the factory default.

Implementation acceptance should cover the motionless default, the complete
speed range, preference restoration, reduced-motion behavior, and equivalent
static communication of direction and status.

## Verification

```sh
cd packages/splunk-cisco-dashboards
yarn typecheck
node test/pieTile.test.cjs
node test/workspaceVisuals.test.cjs
node test/workspaceModalShell.test.cjs
yarn bundle:report
```
