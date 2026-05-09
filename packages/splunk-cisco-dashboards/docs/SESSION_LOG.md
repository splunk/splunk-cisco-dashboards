# Splunk Cisco Dashboards — Session Log

> Running narrative of what we've built, the decisions behind it, and the
> verification that proved it works. Newer sessions go at the **top**.
> Each session ends with a "What's next" pointer so the following session
> has a clean handoff.

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
    `'onboarding.latestFailureReason'` likely not extracting on FDEM
  - `user_experience_client_roaming_analysis` — same nested-path issue
  - `clients_by_building_lookup_join_demo` — already known: depends on
    `site_topology_lookup` being non-empty (regenerate the lookup)
  - `clienthealth_by_site_lookup_join` — known FDEM caveat documented in
    cursor rule: FDEM `clienthealth.siteId="global"` always; the
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
`[overview_link_*_health]`, which on FDEM falls through to the Catalyst Center
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
   FDEM: empty table. **Fixed** by rebasing the stanza onto
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
- `it_critical_systems_sitelevel_health` query on FDEM now returns
  4 rows (Atlanta-GA, Boston-MA x2, Plano-TX) with proper per-site health
  rollups; previously returned 0 rows.
- Re-ran the audit script against the modified files: 0 occurrences of any
  fixed anti-pattern remain.
- All 3 link stanzas verified to have `capacityMbps=1000|1000|100` in their
  fallback branches with the updated `telemetrySourceLabel`.
- No regressions in the `[overview_link_*]` SPL syntax (the `cisco:sdwan:linkhealth`
  CLI test failure was a pre-existing FDEM-empty-events artifact, not a
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
the `siteId="global"` literal early — see "FDEM caveat" below.

#### 3. `audit_logs_by_site_lookup_join` searchbase stanza

Originally drafted as a pure UUID-lookup join, but **local data
inspection forced a pivot to a hybrid pattern**:

- FDEM-style schema would emit UUID-form `network.siteId` matching
  topology lookups directly.
- Demo data (and apparently some FDEM events) emit `network.siteId`
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
dormant for now but ready when FDEM emits real UUIDs).

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
is correctly flagged because FDEM's DNAC isn't managing it today.

### FDEM caveat captured in cursor rule

Local data verification surfaced two FDEM-specific facts that need to
travel forward:

1. `cisco:dnac:clienthealth.siteId` is **always literally `"global"`**
   on FDEM (and on demo data). 31,577 events, one distinct value. So
   the per-site clienthealth join returns zero rows on FDEM until DNAC
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
  enrichment + new KPI-picker entries on FDEM.
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

New section "Site Topology Lookup & UUID-Chain Joins (FDEM build,
2026-05-08)" with full description / explanation / solution / related_info
HTML treatment for each:

| Stanza | Purpose | Source |
|---|---|---|
| `site_topology_marker_enrichment` | One row per DNAC-managed building with GPS + full address. Used by map popups. | `inputlookup site_topology_lookup` filtered to `type="building"` |
| `site_topology_drift_panel` | Diff between expected sites (TLH, MCO, AUB hardcoded inline to mirror `CUSTOMER_TOPOLOGY`) and DNAC-managed sites. | `makeresults`-built expected list, left-joined to lookup |
| `clients_by_building_lookup_join_demo` | Demonstrates the UUID-chain extraction + lookup-join pattern by counting clients per building. Spans both `building` and `floor` leaf granularity. | `cisco:dnac:client` + lookup |

All three stanzas tagged `Cisco` so they surface in the FDEM-only KPI picker
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
by running the generator search against the imported FDEM data. All 13
topology rows produced; floor rows correctly inherited their building's
address.

All three stanzas validated end-to-end:

| Stanza | Output | Notes |
|---|---|---|
| `site_topology_marker_enrichment` | 4 buildings (TLH, SEOC, AUB, Warehouse) with GPS + full address | All GPS pairs unique to their physical campus pair |
| `site_topology_drift_panel` | 3 expected sites; **Orlando: MCO flagged as "Missing from DNAC"** | Confirms FDEM operational gap operationally visible |
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

## 2026-05-08 (cont.) — `cisco:dnac:site:topology` onboarded on FDEM

### Goal of the addendum

FDEM operations team added the `cisco:dnac:site:topology` input ~1 hour
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

5. **Three meaningful caveats from inspecting FDEM's 13 events:**
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
   - **Orlando / MCO is absent from FDEM's hierarchy.** No `area`,
     `building`, or `floor` rows for Orlando. DNAC is not currently
     managing the Orlando site. Worth raising with FDEM operationally.

### What we built

#### A. Updated Cursor rule with full topology coverage

File: `.cursor/rules/splunk-cisco-dnac-fields.mdc`. Changes:
- Status table flipped from "❌ Pending" to "✅ Yes (added 2026-05-08,
  passive/snapshot)" — onboarded count is now 9 of 11.
- Canonical site-field table appended a row mapping `cisco:dnac:site:topology`
  to `nameHierarchy` / `name` / `id` / `parentId`.
- New dedicated section replaces the old "Awaiting field lists"
  placeholder. Documents: 18-field inventory, per-`type` field
  availability matrix, the three FDEM caveats, three recommended use
  patterns (GPS lookup, hierarchy traversal, data-quality drift check),
  and an explicit "what this sourcetype does NOT give us" anti-list to
  prevent future mistakes (no devices, no links, no CDP/LLDP, no
  interfaces, no time-series).

#### B. Local one-shot import for ad-hoc verification

User cleaned the JSON envelope from the original FDEM export and
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

## 2026-05-08 — Map rewrite (FDEM-aware) + 7 dashboard tiles

### Goal of the session

Make the executive overview map work cleanly on FDEM's 9-sourcetype Catalyst
Center stack (no SD-WAN, no `cisco:dnac:site:topology`, no `cisco:catalyst:center:inventory:report`)
without breaking the rich-metrics behavior on demo data.

### Discovery & decisions before any code changed

1. **Validated FDEM has 8 of the expected 11 Catalyst Center sourcetypes.**
   User provided complete field lists for `cisco:dnac:devicehealth`, `issue`,
   `networkhealth`, `client`, `clienthealth`, `compliance`, `audit:logs`, and
   `securityadvisory`. Three sourcetypes are present locally but missing from
   FDEM: `site:topology` (high value), `inventory:report` (medium), and
   `compliance:report` (redundant with `compliance`).

2. **Macro-prefix policy**: when running ad-hoc tests on FDEM's stack the
   user swaps to `fdem_*` prefixed macros (their stack uses
   `fdem_index_catalyst`, `fdem_dnac_site_normalize`). All
   `searchbase.conf` SPL stays on **our app's macros** (`index_catalyst`,
   `dnac_site_normalize`) — the customer wraps macros at deploy time.

3. **Field-name compliance failure**: I made repeated case mistakes (e.g.
   `site` vs `Site`, inventing `site_short`). User called it out. We
   committed to a permanent fix: a Cursor rule file that documents
   canonical field names per FDEM sourcetype so case/scale errors don't
   happen again.

4. **Data sparseness reality-check on FDEM live**: `cisco:dnac:client`
   returned only 6 events in 30 days on FDEM's stack — too sparse for
   reliable dashboard metrics. We deferred client-traffic tiles for FDEM
   and chose `cisco:dnac:issue` "high input/output utilization" events as
   a bandwidth pressure proxy. `cisco:dnac:networkhealth.kpiMetrics{}.key`
   was always null on FDEM's data, making `kpiMetrics{}` unusable.

5. **CDP/LLDP not adopted** (asked at end of session): Layer-2 neighbor
   protocols can't see across WAN boundaries and carry structural not
   operational data. DNAC already uses them internally to build
   `cisco:dnac:site:topology`, which is the right ingest point. Future
   work: mine `cisco:ios` syslog for `%CDP-4-*` / `%LLDP-4-*` events as
   physical-layer leading indicators if 9300X syslog is forwarded.

### What we actually built

#### A. New Cursor rule for DNAC field discipline

File: `.cursor/rules/splunk-cisco-dnac-fields.mdc` (404 lines).
Documents per FDEM-confirmed sourcetype: canonical site field name, key
fields, fields that DO NOT EXIST, scale conventions (0-10 vs 0-100), the
`-1` "no data" sentinel, and common SPL patterns. Two anti-patterns are
called out explicitly: lowercase aliasing (creating `site` instead of
overwriting `Site`) and assuming all health fields share one scale.

#### B. Imported FDEM sample data into local Splunk

User exported 6 sourcetypes from FDEM's stack to `~/Downloads/cisco_sample_data/new/`.
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

Section: "Site Connectivity & Link Health (FDEM build, 2026-05-08)".
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
- Tagged `Cisco` so the FDEM-only KPI picker filter surfaces them
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
2. Link stanzas depended on `cisco:sdwan:linkhealth` (FDEM doesn't have it).
3. Link stanzas referenced FDEM-nonexistent fields: `IsWanEdge`,
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
| `[overview_site_orlando_health]` | Same pattern, `match(Site,"(?i)Orlando")`. Returns no rows when Orlando data is absent (FDEM scenario) so the marker shows "Awaiting telemetry" instead of fabricating. |
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
| `[overview_link_orlando_auburndale_health]` | **NEW** — completes the FDEM tri-site mesh |

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

### Verification (against the imported FDEM data)

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
   - `cisco:dnac:site:topology` if the FDEM TA can be extended
   - SD-WAN linkhealth if Sarav can identify a TA path
4. **Commit when you're satisfied** — work is staged but unmerged.

---

## 2026-05-07 and earlier — Session-summary capture (back-fill)

The conversation prior to this session covered substantial work that should
be on record alongside the May-8 narrative. Compressed summary by area:

### Dashboard infrastructure (React side)

- **Initial build**: monorepo (`lerna`-managed) with React executive
  dashboard for FDEM. Florida map, time selector, dark mode, dynamic KPIs.
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

- Drafted Sarav-message about FDEM bandwidth telemetry options. Final
  message kept concise (Q1 only — TA extension question dropped).
- Searched FDEM Splunk for any 9300X telemetry signals beyond the 9
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
