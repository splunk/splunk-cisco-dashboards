# Catalyst Center Searchbase Implementation Plan

Last updated: 2026-05-06

## Goal

Add first-class `searchbase.conf` coverage for Catalyst Center / DNAC sourcetypes that are new, missing, or too lightly represented, while keeping a clear list of follow-up work we still need to finish.

## Scope

Target sourcetypes:

- `cisco:catalyst:center:compliance:report`
- `cisco:catalyst:center:inventory:report`
- `cisco:dnac:audit:logs`
- `cisco:dnac:client`
- `cisco:dnac:clienthealth`
- `cisco:dnac:compliance`
- `cisco:dnac:devicehealth`
- `cisco:dnac:issue`
- `cisco:dnac:networkhealth`
- `cisco:dnac:securityadvisory`
- `cisco:dnac:site:topology`

## Design split

Use the sources this way:

- Executive inventory and compliance:
  - `cisco:catalyst:center:inventory:report`
  - `cisco:catalyst:center:compliance:report`
- Live health and assurance:
  - `cisco:dnac:devicehealth`
  - `cisco:dnac:networkhealth`
  - `cisco:dnac:issue`
  - `cisco:dnac:clienthealth`
- Change, hierarchy, and topology context:
  - `cisco:dnac:site:topology`
  - `cisco:dnac:audit:logs`

Important: `cisco:dnac:site:topology` is event-oriented context, not steady-state path telemetry.

## Phase 1: First search batch

Status: In progress

Implemented on 2026-05-06:

- `it_critical_systems_inventory_reachability_summary`
- `it_critical_systems_inventory_unreachable_detail`
- `it_critical_systems_inventory_device_family_distribution`
- `it_critical_systems_compliance_report_rate`
- `it_critical_systems_compliance_report_status_distribution`
- `it_critical_systems_compliance_report_noncompliant_detail`
- `it_critical_systems_site_topology_recent_changes`
- `it_critical_systems_site_topology_event_type_distribution`
- `it_critical_systems_site_topology_site_type_distribution`

These cover the three missing sourcetypes:

- `cisco:catalyst:center:inventory:report`
- `cisco:catalyst:center:compliance:report`
- `cisco:dnac:site:topology`

## Phase 2: Strengthen existing Catalyst Center / DNAC coverage

Status: Not started

Planned additions:

### `cisco:dnac:audit:logs`

- Top actors
- Login activity
- Action distribution by `name`

### `cisco:dnac:client`

- Top sites by active clients
- Client OS / connection type distribution
- Inventory-style client census drilldowns

### `cisco:dnac:clienthealth`

- Poor-client hotspot detail
- Health by site
- Health by SSID

### `cisco:dnac:devicehealth`

- Unreachable / unmanaged detail
- Hotspot sites
- WAN-edge operational rollup where fields are truly present

### `cisco:dnac:issue`

- Issue trend over time
- Issue count by site
- Issue count by category / priority

### `cisco:dnac:networkhealth`

- Good / fair / bad composition trend
- Category degradation detector

### `cisco:dnac:securityadvisory`

- Impacted devices by severity
- Advisory exposure by site
- Newly seen advisory trend

## Phase 3: Dashboard mapping

Status: Not started

Map searches to the right dashboards and tiles:

- Prefer report-based inventory / compliance in executive KPI surfaces
- Keep live assurance tiles on devicehealth, networkhealth, issue, and clienthealth
- Use site topology for recent changes, hierarchy churn, and disaster-readiness context

## Phase 4: Map work

Status: In progress

Done:

- Temporary preview link searches added so line animation can be validated visually
- Map now uses larger beacon-style site icons
- Peak throughput and peak utilization are shown in the topology popup

Still needed:

- Replace fake preview link searches with real path telemetry
- Decide whether map items keep text-field `search_name` editing or get a picker like tiles
- Decide whether `site:topology` should appear as an event overlay, timeline, or popup enrichment

## Phase 5: Overview tile UX parity

Status: In progress

Done:

- Major/trend value abbreviation for overview tiles
- Peak marker callout rendered on sparklines
- Sparkline band pinned better so it drifts less on tall viewports

Still needed:

- Decide whether we want full Studio-parity row locking for every tile
- Decide whether peak callouts remain on all tiles or only selected/high-value tiles if visual density becomes too high

## Open decisions

1. Real connectivity source for site-to-site lines
   - We still need a durable source for path health between sites.
   - Current preview lines are intentionally temporary.

2. Compliance source strategy
   - Keep legacy `cisco:dnac:compliance` as first-class, or pivot executive compliance fully to `cisco:catalyst:center:compliance:report`.

3. Map search editing UX
   - Keep lightweight `search_name` editing
   - Or add a tile-style search picker

4. Studio parity level
   - Current overview tiles are improved
   - Full parity would lock header, value, sparkline, and footer rows more strictly

## Validation checklist

- [ ] Build the app successfully
- [ ] Live-validate new search stanzas in Splunk
- [ ] Wire at least one dashboard or admin surface to the new searches
- [ ] Replace temporary preview line searches once real telemetry is ready
- [ ] Re-review `searchbase.conf` for overlap between old DNAC compliance and new report-based compliance
