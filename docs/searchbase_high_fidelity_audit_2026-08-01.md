# Searchbase.conf High-Fidelity Production Audit — 2026-08-01

Target file: `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf`

This audit reviewed every stanza in searchbase.conf against the 13-field high-fidelity contract
(stanza name, search_name, category, sub_category, tags, default_viz, viz_options,
drilldown_search_name, drilldown_button_title, description, explanation, solution, related_info,
search), using ground truth derived from this repository's consumer code
(`searchbaseCatalogue.ts`, `KpiPickerPanel.tsx`, `executive_insights/index.tsx`,
`splunkSearchService.js`) and from real installed Cisco/Splunk apps on this machine
(`/opt/10/etc/apps`, `/opt/splunk/etc/apps`), not from assumption.

**STATUS: complete.** All 1,346 stanzas reviewed across 32 batches (29 via an orchestrated workflow,
3 re-run directly after their first attempt stalled). Final validation passed on every axis checked
(see §10).

---

## 1. Executive summary

- **Corrected a false premise the repo's own tooling had encoded.** Several existing static checks
  in `scripts/audit_searchbase_quality.py` no longer match the real running app: a picker "Cisco tag"
  gate that was removed ~3 builds ago, a 4096-byte SPL length ceiling where the real limit is 300KB,
  a hardcoded `dispatch_context` requirement that breaks for legitimately harvested content, and a
  regex that flags the literal string `"DELETE"` (an HTTP method value) as a destructive Splunk
  command. These accounted for roughly 1,220 of the ~2,000 raw findings from that script and were
  false positives — verified against the actual consumer code and reused-app behavior before being
  set aside, not assumed away.
- **Removed 15 stanzas built on fabricated Cisco/Splunk sourcetypes** (fake Cisco XDR
  "detection/finding/indicator/observable" event types, a nonexistent Endace integration, a
  mismatched Zeek "telemetry" type) — verified against the real installed `CiscoSecurityCloud` app,
  `Splunk_TA_zeek`, and official Splunk documentation, not just plausible-sounding naming.
- **Fixed 7 more stanzas with wrong-but-real sourcetypes** (corrected to the actual TA-shipped names)
  and confirmed 20 more (`Splunk Attack Analyzer`) were real but simply not installed in this local lab.
- **Fixed 14 silent-wrong-results SPL bugs** (Splunk treats single-quoted dotted field names inside
  `stats` aggregation functions as string literals, not field references) and **57 stanzas** where an
  arbitrary `head 100` sat *before* the aggregating `stats`, truncating the population being counted.
- **Rebuilt the taxonomy**: split a 417-stanza "Data Center Networking" catch-all out of the generic
  "Network" category into its own category with 13 real sub-categories derived from the harvester's
  own domain structure; replaced 207 stanzas' meaningless "Dashboard Studio Reconciliation" /
  "Dashboard Studio Same-Root Reconciliation" sub-category (an authoring-provenance label, not an
  operational concept) with content-derived sub-categories, reviewed one category at a time by an
  agent that read each stanza's actual search and description.
- **Adjudicated all 31 clusters of SPL-signature duplicates (86 stanzas)** — every one was a
  legitimately distinct search (wired/wireless pairs, connect/disconnect pairs, KPI-tile +
  full-trend pairs, demo-state variants, per-message-type breakdowns), not accidental duplication.
  Applied 10 targeted naming-clarity fixes the adjudication surfaced.
- **Found and fixed a real structural bug the file's own age had hidden**: 10 stanzas had the same
  key (`drilldown_search_name`/`drilldown_button_title`) defined twice, where Splunk's config
  last-key-wins semantics silently discarded the first pair — invisible to a naive single-match
  check. Investigating those surfaced a further systemic bug: 8 stanzas (an account-lockout KPI and
  a cluster of power-event searches) were drilling into completely unrelated targets via a broad,
  wrong fallback assignment from a prior run of this repo's own `apply_drilldowns.py`. Retargeted
  them to the real matching detail searches after verifying what each one actually outputs.
- **Ran a full 13-field high-fidelity review across every stanza** via 32 independent batches (one
  agent per ~55-stanza slice, organized by category), applying 471 field-level corrections
  (tags, descriptions, explanations, solutions, drilldown wiring, `default_viz`/`viz_options`
  corrections, search_name clarity) — while catching and repairing a data-quality issue in the
  review output itself (some batches wrote instructional placeholder text like
  `"(remove — no target exists)"` as a literal field value instead of leaving the field empty;
  swept the whole file for this pattern before it could ship).
- **Closed out the last 3 of 32 review batches** (136 stanzas) after they stalled inside the workflow
  orchestration layer — re-ran them as independent agents instead of retrying the same mechanism, and
  applied their results. One of those three (NetOps Readiness) cross-checked every stanza against the
  actual shipped Dashboard Studio XML and the composite-score tuning macros, and surfaced a genuine,
  previously undocumented discrepancy: the "Quality" sub-score of the Network Readiness Score is
  computed two different ways by sibling panels (a 3-factor health/onboarding/RSSI blend in one tile,
  average-client-health-only in four others), and the documented D_risk multiplier is never actually
  applied to the trend/forecast/per-site panels despite the formula comment saying it should be.
  Documented this factually in the affected stanzas' explanation fields rather than silently altering
  the SPL (correcting the underlying formula divergence is a product decision, out of scope for a
  metadata audit). Another batch (Monitoring) found that ~35 of 48 ThousandEyes stanzas' explanation
  text described a raw index_thousandeyes macro and sort commands that don't exist anywhere in the
  actual SPL (which runs tstats against accelerated Cisco_ThousandEyes data models) — corrected all of
  them to describe the real query mechanism, and fixed a batch of visibly truncated/garbled
  descriptions in the same family (dropped words mid-sentence from an earlier authoring pass).

## 2. Counts

| Measure | Count |
|---|---:|
| Original stanzas (after correcting a stanza-counting bug — see §10) | 1,361 |
| Removed (fabricated sourcetype, no real product backing) | 15 |
| Stanza renamed (Endace → Zeek correction) | 1 |
| Retained unchanged after review (no field issues found) | ~900 |
| Rewritten / field-corrected (≥1 field changed) | ~450 |
| Consolidated (true duplicates merged) | 0 (all 31 candidate clusters were legitimately distinct) |
| **Final stanza count** | **1,346** |

Approximate breakdown of field-level corrections applied across the whole audit: 86 tags, 63+97
description/explanation corrections in the ThousandEyes documentation-drift sweep, 60 drilldown_button_title,
51 viz_options, 45+ drilldown_search_name, 44 search_name, 38+ default_viz, 33 explanation, 22 solution,
18 related_info, 10 sub_category (plus the separate 207-stanza taxonomy reassignment in §6), 1 category.

## 3. Duplicate and consolidation report

31 clusters (86 stanzas) shared an SPL signature after normalizing string/numeric literals. Every
cluster was independently adjudicated by reading each member's full field set and actual SPL.
**Verdict: 0 true duplicates.** Patterns found, all matching the task's own definition of
legitimate distinctness:

- Per-entity-type breakdowns sharing one template (wired vs. wireless, ACI/MSO/ND syslog message
  types, connect vs. disconnect events) — 22 clusters.
- Primary-KPI + full-trend pairs (same underlying metric, one rendered as a `singlevalue` tile with
  sparkline, one as a full time-series chart for a different view) — 6 clusters.
- Demo/preview state variants (healthy/warning/critical) that back the KPI-picker's empty-state
  preview — 2 clusters.
- One pair distinguished by *which fields* the shared template groups by, not just a filter literal
  (TrustSec hardware readiness vs. software/license compatibility) — 1 cluster.

Applied 10 naming-clarity fixes the adjudication specifically recommended (KPI-tile vs. trend
disambiguation, casing fixes, explicit "(All Clients)" labels) — see the ledger for the full list.

## 4. Main-search and drill-down relationship report

- 401 of 1,346 stanzas populate `drilldown_search_name`. **0 orphaned** (every target resolves to a
  real `search_name`). **0 self-referencing.**
- **10 stanzas had duplicate `drilldown_search_name`/`drilldown_button_title` keys** — Splunk's
  config parser silently keeps only the last-defined value per key within a stanza, so the first
  pair in each of these was dead, invisible residue. Root cause: a prior (pre-session) run of this
  repo's `apply_drilldowns.py`/`map_drilldowns.py` re-added a drilldown to stanzas that already had
  one. Fixed all 10, stanza-scoped so no unrelated occurrence of the same text elsewhere in the file
  was touched.
- Investigating those surfaced a **systemic wrong-fallback-target bug** affecting 8 stanzas across
  two unrelated clusters:
  - `security_resilience_locked_accounts`, `security_resilience_locked_accounts_detail`, and
    `security_resilience_ds_base_fw` all pointed to `Security Resilience - Top Blocked Destinations`
    — a firewall-destination search with no relationship to account lockouts.
  - `it_critical_systems_power_event_detection`, `power_event_summary`, `power_impact_report`,
    `power_outage_history`, and `site_power_events_24h_trend` all pointed to
    `IT - Critical Systems - IOS NTP Time Drift` — a clock-synchronization search unrelated to power
    events.
  - Fix: retargeted the KPI/summary stanzas in each cluster to the real matching detail table
    (verified each one's actual output columns first — e.g. `Power Outage History` genuinely emits
    date/time/severity/affected-devices/host columns), and cleared the drilldown on the two stanzas
    that are themselves the terminal detail table (a table shouldn't drill further into itself).
- 5 additional drilldown relationships added where the 32-batch review found a genuine, verified
  target that had been missing (each target's existence as a unique `search_name` was confirmed
  before wiring it up): `network_ccc_compliance_rate_kpi`, `executive_dashboard_xdr_incident_count`,
  `secure_networking_fmc_top_policies_by_action`, `feed_monitor_meraki_api_staleness`,
  `teuc_fit_alert_volume_timeslot_anomaly`.

## 5. SPL modernization report

- **`head`**: 212 stanzas used `head` at baseline (down to 155 after fixes). Of those, **57 were a
  real bug** — `head 100` sat *before* the aggregating `stats count by <field>`, silently limiting
  the aggregation to the 100 most-recent raw events regardless of how many actually matched in the
  selected time range (all in the `dc_networking_harvest_{aci,mso,n9k,nd}_syslog_*` family — harvested
  dashboard-panel residue, since the source panels displayed raw events capped at 100 rows for
  *display*, and that cap was carried over even after an aggregation was added on top). Removed the
  truncating `head` in all 57; the `stats` now aggregates the full matched population. Verified
  0 remaining head-before-aggregation instances catalog-wide. The remaining `head` usages that
  survive review follow a `sort <field> | head N` (or equivalent bare-search reverse-chronological)
  pattern for an intentional, clearly-named top-N or most-recent view — preserved per the task's own
  guidance to keep documented, intentional top-N ranking.
- **`dedup`**: no arbitrary/lossy `dedup` requiring replacement found beyond what prior sessions had
  already addressed; spot-checked usages during the field review were paired with `stats`/`latest()`
  patterns that preserve the fields drilldowns depend on.
- **Hardcoded `span=`**: none found blocking user-selected time range control during this review.
- **14 silent-wrong-results bugs** (R001, `lint_spl_antipatterns.py`): single-quoted dotted/bracketed
  field names inside `stats`/`chart`/`timechart` aggregation functions (e.g. `dc('thousandeyes.test.name')`)
  are treated by Splunk as string literals, not field references — the aggregate silently computes
  over a constant instead of real per-event data. Fixed in: `building_resilience_spaces_location_breakdown`,
  `dashboard_building_v1_kpi_devices`, `it_critical_systems_wan_bandwidth_detail`,
  `user_experience_bandwidth_trend`, `user_experience_wan_latency_by_uplink`,
  `spaces_predict_iot_temperature_forecast`, and 5 `secure_networking_thousandeyes_*` stanzas.
  Verified 0 remaining R001 violations catalog-wide.
- **4 `default_viz_requires_time_series` fixes**: `splunk.line` was selected but the final aggregation
  (`xyseries` / `chart ... by <renamed field>`) didn't retain a literal `_time` column. Renamed the
  pivot/x-axis field to `_time` in each of the 4 affected DC Networking controller-statistics/
  congestion stanzas.
- **Reviewed and left unchanged** (confirmed reasonable, not defects): `round()` precision other than
  2 decimals (9 hits — several are legitimately more precise, e.g. sub-second API latency); `spath`
  usage (5 hits — necessary for nested JSON fields, not a real inefficiency); commands following
  `timechart` other than the standard allow-list (15 hits — spot-checked the two highest-risk "stats
  after timechart" cases and both were `union` of independent timecharts merged back into one wide
  row via `stats values(*) by _time`, a correct, standard idiom, not a time-series-collapsing bug).

## 6. Final category / sub-category taxonomy

14 top-level categories, 0 blank. The former 417-stanza "Data Center Networking" blob (previously
filed under `Network`) is now its own category with 13 real sub-categories; the 207 stanzas
previously labeled with the internal-provenance sub-category "Dashboard Studio Reconciliation" /
"Dashboard Studio Same-Root Reconciliation" now carry content-derived sub-categories (39 distinct
values across the 7 affected categories, max 8 per category).

Final category distribution (1,346 stanzas, 0 blank category):

| Category | Count |
|---|---:|
| Data Center Networking | 417 |
| Network | 231 |
| Security | 211 |
| Monitoring | 131 |
| Identity | 82 |
| Cisco Spaces | 71 |
| Network Activation | 54 |
| Building | 50 |
| IT Health | 38 |
| NetOps Readiness | 26 |
| Asset | 18 |
| Workplace | 8 |
| ThousandEyes | 6 |
| Admin | 3 |

Data Center Networking's 13 sub-categories (derived from the harvester's own domain structure):
Controller & Site Inventory (70), ACI Tenant & Policy (63), Multi-Site Orchestrator (55), ACI Fabric
Health (43), Nexus 9000 Platform (39), ACI Syslog & Events (32), Nexus Dashboard Syslog (29),
Authentication & Audit (22), Nexus Dashboard Traffic & Flow (22), Nexus Dashboard Interfaces (16),
Compliance & Advisories (13), VMware Integration (10), Application Discovery (3).

The 7 categories whose stanzas previously carried the meaningless "Dashboard Studio Reconciliation"
sub-category now have content-derived sub-categories instead, e.g. IT Health: Issue Tracking (11),
Device Health (9), Client Health (5), Device Inventory (5), Network Health (3), Configuration Auditing
(2), Network Alerts (2), Network Authentication (1); NetOps Readiness: Network Readiness Score (5),
Capacity Planning (5), Occupancy Analytics (5), Readiness Score Components (4), Client Experience (4),
Issue Tracking (3). Full machine-readable breakdown regenerated at
`artifacts/searchbase/reports/searchbase_review_report.json` after every edit
round.

## 7. Controlled tag vocabulary

615 distinct tags in use. Removed one confirmed pure-synonym redundancy: the generic
`Data Center Networking` tag (100% co-occurring with, and now identical in wording to, the
`Data Center Networking` *category*) was dropped from all 417 affected stanzas, keeping the more
specific, branded `Cisco DC Networking` tag. Checked all other high-co-occurrence tag pairs
(`Data Model`/`TStats`, `TA Stock Dashboard`/`dCloud`, `Cisco ACI`/`Cisco DC Networking`, etc.) —
none were genuine synonyms; each conveys distinct, non-redundant information.

**Open recommendation, not applied**: the `Cisco` tag is used by `scripts/tag_single_metric_searches.py`
as a curated "tile-ready trend" marker, but this convention has no live enforcement in the current
UI code (the picker gate that once used it was removed) and a prior review round explicitly
described the ~150+ pending tag additions as "proposed... not applied." Left as-is; flagged for the
team to decide whether to continue or retire this convention.

## 8. Visualization and visualization-options report

Real rendered `default_viz` enum, confirmed against `canvasVizPredicates.ts` / `Sparkline.tsx` /
`executive_insights/index.tsx` (**not** the spec file, which is out of date): `splunk.table`,
`splunk.singlevalue`, `splunk.singlevalueicon`, `splunk.column`, `splunk.line`, `splunk.pie`,
`splunk.bar`, `splunk.singlevalueradial`, `splunk.area` (the silent fallback for missing/unrecognized
values — **not** `splunk.table`, contrary to the spec), `splunk.fillergauge`, `splunk.markergauge`.
`splunk.events`/`splunk.map`/`splunk.scatter`/`splunk.sankey`/`splunk.punchcard` have no special
rendering and silently degrade to a meaningless area sparkline.

- Corrected 9 stanzas using an unsupported type (map/scatter/sankey/punchcard) to `splunk.table`
  (verified their `viz_options` had no type-specific keys that would be orphaned by the switch).
- Corrected ~40 more `default_viz` mismatches during the full-catalog review (wrong viz for the
  actual SPL output shape — e.g. `splunk.singlevalue` on a genuine multi-row timechart, `splunk.column`
  mislabeling a real time series that should be `splunk.line`, or `splunk.table` on a single collapsed
  KPI row that should be `splunk.singlevalue`). Several of these were cross-checked directly against
  the real shipped Dashboard Studio panel type in the source XML, not just the SPL shape.
- Added a missing `valueField` to one overview-tile `viz_options` entry that had nothing to bind to
  (would have rendered blank); fixed one `viz_options.thresholdNote` that duplicated a broken
  stanza-name reference already fixed elsewhere in the same stanza's `solution` field.
- Corrected several `viz_options.stackMode` values that contradicted both their own stanza's
  `search_name` ("stacked by severity") and the real shipped dashboard panel (which used `stacked`
  while searchbase said `unstacked`), and removed `showSparkline`/multi-color palettes left over on
  single-row composite-score tiles that have no `_time` series to sparkline.
- Final default_viz distribution (1,346 stanzas, 0 outside the verified-real enum): splunk.table 613,
  splunk.singlevalue 216, splunk.line 138, splunk.pie 111, splunk.column 100, splunk.area 92,
  splunk.bar 63, splunk.markergauge 6, splunk.singlevalueradial 4, splunk.fillergauge 3.
- All `viz_options` values in the final file validate as parseable JSON.

## 9. Verified documentation / related_info links

Only 2 external links exist across the entire catalog's `related_info` fields (the field is used
almost entirely for internal cross-references between stanzas, consistent with a "zero is better
than filler" policy):

- `https://atlas.mitre.org/` — confirmed live, the real MITRE ATLAS site.
- `https://www.cisco.com/site/us/en/products/security/ai-defense/index.html` — automated fetch
  returned HTTP 403 (cisco.com commonly blocks non-browser user agents); the URL shape matches a
  real, current Cisco product page. Recommend a manual browser check; not treated as broken given
  the ambiguity of a WAF-style 403.

## 10. Validation commands and results

```
python3 scripts/lint_spl_antipatterns.py packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf
  -> OK (0 violations; was 14 at baseline)

git diff --check packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf
  -> exit 0 (clean; fixed 6 trailing-whitespace lines and 8 instructional-placeholder-text lines my
     own edit passes introduced along the way, before this final state)

grep -cE '^\[[^]]+\]\s*$' searchbase.conf  -> 1346 (strict stanza-header parser; confirmed matches
  the parser python3 scripts/audit_searchbase_quality.py uses internally)
```

Custom read-only Python checks (scratch scripts, not committed), run fresh after the final edit round:
- 1,346 stanzas total (0 blank category, 0 blank sub_category)
- 0 duplicate `search_name` values
- 0 orphaned `drilldown_search_name` targets (401 populated, all resolve)
- 0 self-referencing drilldowns
- 0 duplicate field keys within any stanza (all 10 found-and-fixed instances confirmed gone)
- 0 instructional-placeholder text left as a literal field value, in any field, file-wide
- 0 stanzas with `head` truncating an aggregation's input population (all 57 found-and-fixed
  instances confirmed gone; 155 stanzas still use `head` in a legitimate top-N/most-recent context)
- 0 `viz_options` values that fail to parse as JSON
- 0 `default_viz` values outside the verified-real 11-value enum
- `python3 scripts/build_searchbase_review_report.py` regenerates cleanly against the final file
  (1,346 searches)

## 11. Remaining limitations / not run-time validated

- No live Splunk instance was queried to confirm actual result correctness (`search` semantics were
  validated by static reasoning against known Splunk behavior and cross-referenced against real
  installed apps' field extractions — not by dispatching searches).
- The `Splunk Attack Analyzer` sourcetypes (20 `xdr_aa_*` stanzas) are verified real per official
  Splunk documentation but could not be locally validated since that add-on isn't installed in this
  lab environment.
- Out-of-scope confirmed bug, reported but not fixed (not one of the 13 contracted fields): the
  dashboard-builder's separate "Select Searchbase Search" picker (`SelectSearchbaseSearchSidebar.jsx`)
  gates on `search_type == 'display'`, and 0 of 1,346 stanzas set `search_type` at all, so that
  picker's result list is always empty — the same failure shape as a previously-fixed picker bug
  elsewhere in this codebase.
- `Cisco` tag convention (tile-ready-trend marker) left unresolved — see §7.
- A documented, not-fixed formula discrepancy in the NetOps Readiness family: the composite Network
  Readiness Score's "Quality" sub-score is computed one way in its own standalone tile
  (`score_q`: 35% client health / 35% onboarding speed / 30% RSSI) and a different, simpler way inside
  the trend/forecast/per-site panels that also compute NRS (`score_nrs_trend`, `score_nrs_spark`,
  `score_per_site`, `a_nrs_forecast`: average client health only). The documented `D_risk` multiplier
  is likewise never actually applied to those same four panels despite the formula comment implying it
  should be. This is a real product/SPL inconsistency, not a metadata error — flagged in each affected
  stanza's `explanation` field and here for the team to decide whether the panels should be reconciled.
- 3 of 32 full-catalog review batches (136 stanzas: Data Center Networking part 6/8, Monitoring part
  1/3, NetOps Readiness part 1/1) stalled inside the workflow orchestration layer on first attempt.
  Re-run as independent agents outside that layer and applied successfully — see §1 for what they found.
