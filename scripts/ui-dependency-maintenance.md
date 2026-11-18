# UI dependency maintenance (maintainers)

Reviewed 2026-11-16. This document describes engineering maintenance, not
customer release notes. React and React DOM remain 18.3.1, consistent with the
installed Splunk Dashboard peer requirements.

## Current update

| Package | Previous locked version | Selected version |
| --- | --- | --- |
| @splunk/react-ui | 5.13.0 | 5.18.0 |
| @splunk/react-icons | 5.15.0 | 5.17.0 |
| @splunk/themes | 1.10.0 | 1.13.1 |
| @splunk/ui-utils | 1.14.0 | 1.15.0 |
| dompurify | 3.4.17 | 3.4.18 |
| fast-xml-parser | 5.12.0 | 5.12.1 |

The initial local installation of fast-xml-parser was 5.10.1 despite the lockfile
requiring 5.12.0. A frozen install reconciled it before the version updates.

The selected Splunk UI packages retain React 18 peer compatibility. The new UI
release requires ui-utils ^1.15.0 and themes ^1.13.1. Root resolutions keep the
UI, icon, theme and utility versions consistent with the direct workspace
requirements: otherwise Yarn retains older transitive copies alongside the new
ones. This matters for shared theme context and consistent component behavior.
All existing consumer version ranges for these resolved packages accept the
selected releases; investigate any new incompatible-resolution warning.

The official package CHANGELOG.md files describe improved table focus and row
readability, dropdown resizing, menu semantics, touchscreen tooltips, stronger
link contrast, and updated 1CD navigation/sidebar contrast. The app already uses
the 1CD theme customizer. This update does not replace the design system, change
the React major, or enable opt-in glass/transparency treatments.

The maintained braces and @splunk/charting-bundle patches must continue applying
with postinstall scripts enabled. Do not bypass patch failures or use
--ignore-scripts to force an installation through.

## Separate Dashboard/Visualization migration

Keep Dashboard 29.8.0, Visualization 28.8.0 and patched charting-bundle 28.8.0
until the charting fixes have a reviewed successor. Registry review found
Dashboard 29.9.0 and Visualization/charting-bundle 28.9.1. The newer charting
bundle is minified and still contains both unguarded debug loggers and uses of
Highcharts.each in the progressive-render overrides. Simply renaming the old
patch is insufficient.

1. Port or replace both diagnostic logging gates and both progressive-render
   iteration fixes without introducing a large opaque minified-bundle patch.
2. Exercise debug opt-in, retained warning/error/info logging, and progressive
   chart drawing against the real successor bundle.
3. Update the entire Dashboard/Visualization dependency family coherently,
   preserving React 18.3.1 and compatible peer versions.
4. Validate native Dashboard Builder, preset schema compatibility, chart domains,
   interactions, saved definitions and published/read-only dashboards.

## Separate Recharts 3 migration plan

Recharts remains at locked version 2.15.4. Version 3.10.1 was current at review;
recheck the registry and upstream migration notes before implementation. Upstream
states that version 2 no longer receives updates. React 19 is not required for
Recharts 3: it supports React 18, and the project already exceeds its Node 18,
TypeScript 5 and ES6 target minimums.

Direct import surfaces:

- src/main/webapp/common/components/workspace/Sparkline.tsx
- src/main/webapp/common/components/workspace/SignalRailShowcase.tsx
- src/main/webapp/pages/health_monitoring/components/MetricCard.tsx
- src/main/webapp/pages/m365_activity_monitoring/index.tsx
- src/main/webapp/pages/secure_operations_glass/index.tsx
- src/main/webapp/pages/secure_networking_pillars/charts.tsx

All paths above are relative to packages/splunk-cisco-dashboards.

1. Capture representative chart behavior before changing the major: tooltip text
   and contrast, min/max markers, null gaps, single/constant/empty series,
   multiple axes, resizing, dark/light themes and mouse/keyboard interactions.
2. Upgrade only Recharts and its necessary dependencies. Remove the obsolete
   isFront props on Sparkline ReferenceDot elements and verify SVG/render order
   preserves marker visibility. Audit custom tooltip payload types and axis
   domains against the v3 APIs rather than suppressing type errors.
3. Revisit operationsQualification.test.cjs: it renders Tooltip directly with
   explicit payload/active props. V3 owns more tooltip state in chart context;
   exercise complete charts and interactions where required. Preserve the
   existing checks for readable tooltip items, including missing/black colors.
4. Verify automatic accessibilityLayer behavior, chart focus, arrow navigation,
   screen-reader names and non-conflicting workspace shortcuts. Decide how
   decorative sparklines should participate in keyboard navigation instead of
   making every tiny chart a distracting extra stop.
5. Run type checking, component/interaction tests, customer-documentation
   contracts and webpack compilation. Inspect the actual rendered charts before
   claiming visual acceptance. Packaging, installation and runtime acceptance
   are separate subsequent steps and require their applicable authorization.

Sources: package metadata and CHANGELOG.md from the official npm releases;
[Recharts migration guide](https://github.com/recharts/recharts/wiki/3.0-migration-guide),
[Recharts accessibility](https://github.com/recharts/recharts/wiki/Recharts-and-accessibility),
[Recharts v2 maintenance notice](https://github.com/recharts/recharts/issues/7361).
