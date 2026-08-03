# LA28 Math — the COMPUTATION layer

> Layer 2 of the SCD framework. See `COMPASS.md` for the QUESTION layer and `CONTEXT_TENSOR.md` for the CATALOG layer.

This document specifies the **closed set of 11 canonical macros** that compute every executive metric in the Splunk App for Secure Networking (SCD) app. The macros are defined in `default/macros.conf` and called by every saved search, every dashboard panel, and every drilldown.

**Hard rules:**

1. **Never inline this math anywhere.** Quality, retainability, E-Score, uptime SLA, and MTTR are computed only by their respective macros. Panel SPL that copy-pastes the formula is a bug.
2. **The macro count is closed at 11.** If you find yourself wanting a 12th macro, stop and tell me. Panel-specific transformations live as inline SPL inside the dashboard, not as reusable macros.
3. **No `makeresults | eval random()` to fake values.** When data is missing, the panel is a `[DATA-GAP]` placeholder, not a synthetic chart. See [Data inventory](#data-inventory) below.

---

## Formula bank

### 1. Availability

The fraction of time a service is reachable, expressed as a percentage 0..100.

```
Availability = avg(http_availability_metric)
```

In SCD, availability is read directly from ThousandEyes HTTP test metrics (`http_availability_metric`) when wired. For Cisco Catalyst Center DNAC reachability, availability is the percentage of devices with `Reachability="Reachable"` over the time window.

There is **no `scd_availability(...)` macro** — availability is a primitive that flows in as a field. The other macros consume it.

### 2. Retainability — `scd_retainability(errors_count_field, total_count_field)`

The fraction of requests *not* terminated by an error, expressed as 0..100.

```
Retainability = (1 - errors_count / total_count) * 100
```

The `errors_count_field` is the count of "real" errors. **`scd_errors_filter`** (macro #7 below) defines what counts as a real error — see [4xx exclusion](#4xx-exclusion-list--rationale).

```spl
| `scd_retainability(error_count, total_count)`
```

Output field: `retainability` (0..100, two decimal places).

### 3. Quality — `scd_quality_score(p95_latency_ms_field)`

A clamped, inverted projection of p95 latency onto 0..100.

```
Quality = 100 * clamp((300 - p95_latency_ms) / 250, 0, 1)
```

Reads:
- p95 = 50ms  → Quality = 100
- p95 = 175ms → Quality = 50
- p95 = 300ms → Quality = 0
- p95 ≥ 300ms → Quality = 0 (clamped)
- p95 ≤ 50ms  → Quality = 100 (clamped)

The 50ms / 300ms thresholds are calibrated for executive HTTP traffic. For non-HTTP latencies (e.g. Wi-Fi association RTT, DNS lookup), the threshold is wrong; use a panel-local calc and document the override in the panel's storyboard entry.

```spl
| `scd_quality_score(p95_latency_ms)`
```

Output field: `quality` (0..100, two decimal places).

### 4. E-Score — `scd_escore(a_field, r_field, q_field, w_a, w_r, w_q)`

The composite "experience score" — a weighted blend of Availability, Retainability, and Quality.

```
E-Score = A * w_a + R * w_r + Q * w_q
```

`w_a + w_r + w_q` should equal 1.0; the macro does **not** normalise. Surfaces of `> 100` or `< 0` indicate either a bad weight or a bad upstream value.

```spl
| `scd_escore(availability, retainability, quality, $w_a$, $w_r$, $w_q$)`
```

Output field: `escore` (0..100, two decimal places).

#### Weight presets

The `w_a`, `w_r`, `w_q` arguments are normally driven by a dashboard input dropdown bound to one of these presets:

| Preset | `w_a` | `w_r` | `w_q` | When to use |
|---|---|---|---|---|
| `balanced` | 0.40 | 0.30 | 0.30 | **Default for SCD app** |
| `la28` | 0.20 | 0.30 | 0.50 | Live-event UX-heavy: quality dominates because latency on broadcast pipelines is the headline failure mode |
| `emergency_ops` | 0.50 | 0.20 | 0.30 | EOC / state-ops: availability dominates because "is the service up?" is the headline question for an emergency manager |
| `custom` | `$w_a$` | `$w_r$` | `$w_q$` | User-supplied tokens — three numeric inputs render when the dropdown selects `custom` |

Push back if a preset is named that doesn't match the audience for the dashboard.

### 5. Uptime SLA % — `scd_uptime_sla(availability_field, target_pct)`

The percentage of time-buckets in which availability met or exceeded the target. Use this for monthly / quarterly SLA rollups.

```
Uptime SLA % = (hours where avg(availability) >= target) / total hours * 100
```

```spl
| bin _time span=1h
| stats avg(availability_metric) as avg_avail by _time
| `scd_uptime_sla(avg_avail, 99.5)`
```

`target_pct` allow-listed values: `99.0`, `99.5`, `99.9`, `99.99`. Bind to a dropdown; do not accept arbitrary strings.

Output fields:
- `uptime_pct` — the SLA percentage (0..100, two decimal places)
- `breached` — 0 or 1 per row (binned hour); add `| stats sum(breached) as breached_hours` to roll up

### 6. MTTR — `scd_mttr_minutes(duration_seconds_field)`

Mean time to resolve, in minutes, rounded to two decimal places. Operates over alerts where `status IN ("Resolved","Closed")`.

```
MTTR (minutes) = avg(duration_seconds / 60) over resolved alerts, by severity
```

The macro adds the `mttr_min` field. The caller is responsible for the `where status IN (...)` clause and the `by severity` grouping.

```spl
| where status IN ("Resolved", "Closed")
| `scd_mttr_minutes(duration_seconds)`
| stats avg(mttr_min) as mttr by severity
```

### 7. Severity → Priority map — `scd_severity_to_priority(vendor_severity_field)`

Vendor severity strings vary (`CRITICAL` / `MAJOR` / `Sev-1` / `1` / `P1` / etc). The macro normalizes to `P1`..`P4`.

| Vendor severity | SCD priority |
|---|---|
| `CRITICAL` | `P1` |
| `MAJOR` | `P2` |
| `MINOR` | `P3` |
| `INFO` | `P4` |
| anything else | `P4` (with `_unmapped=1` flag) |

```spl
| `scd_severity_to_priority(severity)`
```

Output field: `priority` (`P1`..`P4`).

---

## Filter macros

### 8. `scd_errors_filter`

Returns a where-clause fragment that defines what counts as a "real" error for retainability calculations.

```
status >= 500 OR (status >= 400 AND status < 500 AND status NOT IN (401, 403, 404, 409, 429))
```

```spl
| where `scd_errors_filter`
```

#### 4xx exclusion list — rationale

The default retainability formula counts every `5xx` AND every `4xx` *except* the following five status codes, because each represents a normal flow that should not penalize the service's retainability score:

| Status | Why excluded |
|---|---|
| **401 Unauthorized** | The client is unauthenticated. The service is functioning correctly by rejecting them. Counting 401s as errors penalises any login flow. |
| **403 Forbidden** | The client is authenticated but not authorized. The service is enforcing policy correctly. Counting 403s as errors penalises any authorization boundary. |
| **404 Not Found** | The resource does not exist. With static-asset-heavy modern UIs (favicons, sprite sheets, route-guess prefetch), 404s are unavoidable noise that doesn't reflect service health. |
| **409 Conflict** | Optimistic-concurrency collisions and idempotency-key replays. Indicates the service is *protecting* state, not failing. |
| **429 Too Many Requests** | Rate limiting is the service working as designed. Counting 429s as errors hides actual capacity from the operator. |

`5xx` stays in even though "503 Service Unavailable" is technically a graceful response — at 503 volume above noise, the user experience is broken regardless of what the wire protocol says.

If you need to override the exclusion (e.g. you're scoring a payments endpoint where 409 is genuinely an error), use a panel-local where-clause instead of editing the macro. Document the override in the panel's storyboard entry.

### 9. `scd_human_user_filter`

Returns a where-clause fragment that excludes system / service accounts. Used by audit-log panels (`cisco:dnac:audit:logs`) to filter to human-attributable changes.

The exclusion patterns are ported from the previous app's `ds_config_changes` saved search:

```
userId NOT IN ("system", "scheduler", "automation", "*-svc", "*_svc", "anonymous")
AND userId != ""
```

```spl
| where `scd_human_user_filter`
```

---

## Compare macros

### 10. `scd_compare_p95(metric_field, by_field)` — vs 7-day p95

Adds a baseline equal to the 95th percentile of the metric over the prior 7 days, plus the delta.

```spl
| `scd_compare_p95(latency_ms, site)`
```

Output fields:
- `baseline_p95` — the 7-day p95 of `latency_ms` per `site`
- `delta_from_p95` — `latency_ms - baseline_p95` (signed)

Computed via `eventstats perc95(metric) as baseline by <by_field>` with an internal `earliest=-7d@d` overlay; the macro does not consume a time-range token.

### 11. `scd_compare_lkg(metric_field, by_field)` — last-known-good

Adds a baseline equal to the latest known value from the last 7 days, plus the delta.

```spl
| `scd_compare_lkg(escore, site)`
```

Output fields:
- `lkg` — the most recent value of the metric over `earliest=-7d`
- `delta_from_lkg` — `metric - lkg` (signed)

### 12. `scd_compare_allowlist(lookup_name, key_field)` — allow-list / threat-intel

Joins the data set against a Splunk lookup and adds a boolean flag for whether the row's key is *outside* the allow-list (or *inside* the threat-intel list, depending on lookup semantics).

```spl
| `scd_compare_allowlist(known_admins.csv, userId)`
```

Output field:
- `is_outside_allowlist` — 1 if the key is **not** in the lookup, 0 if it is

For threat-intel use: invert in the panel SPL (`| where is_outside_allowlist=0` reads "this user is on the threat list").

---

## Index macros

These are not *math* macros, but they belong in this doc because every saved search calls them.

| Macro | Definition target | Purpose |
|---|---|---|
| `index_catalyst` | DNAC sourcetypes (`cisco:dnac:*`) | Canonical Catalyst Center search scope |
| `index_spaces` | Cisco Spaces firehose | Canonical Spaces search scope |
| `index_network` | `cisco:ios` (currently broken — see [Data inventory](#data-inventory)) | Canonical network search scope |
| `index_security` | Security events | Canonical security search scope |
| `index_thousandeyes` | `thousandeyes:*` (placeholder until wired) | Canonical ThousandEyes search scope |

Use the un-prefixed `index_*` macros as the stable app contract. Customer-specific aliases should not be introduced unless a migration requires them.

---

## Data inventory

This is the **locked** list. New panels never assume sourcetypes outside it. Push back if a request requires data not in this list.

### REAL (available in the customer environment)

| Sourcetype | Notes |
|---|---|
| `cisco:dnac:devicehealth` | `HealthScore`, `OverallHealth` (0–10), `Site`, `DeviceFamily`, `Reachability`, `Manageability`, `Memory%`, `CPU%` |
| `cisco:dnac:networkhealth` | `healthScore` by category |
| `cisco:dnac:clienthealth` | `clientType`, `scoreType`, `scoreValue` |
| `cisco:dnac:audit:logs` | Audit events: `userId`, `description`, `parentInstanceId`, `instanceId` |
| `cisco:dnac:alerts` | Severity-tagged alerts |
| `cisco:spaces:firehose` | `SPACE_OCCUPANCY`, `DEVICE_PRESENCE`, `DEVICE_ASSOCIATION` events |

**Local-dev caveat.** Empty results on local Splunk are expected and not blockers. Wiring tests (REST job dispatch + macro expansion) substitute for value-rendering checks at agent acceptance time.

### PARTIAL / unreliable

| Sourcetype | Issue |
|---|---|
| `cisco:ios` | Customer's kiwi syslog server is dying; `%PARSER-5-CFGLOG_LOGGEDCMD` events absent. Don't design panels around CLI-config-change correlation until the syslog ingest is fixed. |

### DOES NOT EXIST in customer env (do not design panels)

- `meraki:*` — any Meraki sourcetype
- `cisco:sdwan` — any SD-WAN sourcetype

### EXPECTED but not yet wired (use `[DATA-GAP]` placeholders)

| Sourcetype | Used by |
|---|---|
| `thousandeyes:*` | Network Quality Deep Dive (Quality / Retainability composite) |
| `cisco:ise:syslog` | Identity-attested logins |
| `WinEventLog:Security` | Admin lateral-movement correlation |
| Cisco XDR feed | XDR placeholder tile |
| NetFlow / Stream | Traffic-volume composite (placeholder until wired) |

### Site naming

DNAC `Site` values are the full hierarchy: `Global/Florida/<City>/<Code>`. **Always filter with LIKE+OR variants — never literal equality.** Use the `scd_site_filter` pattern (port from old app at Gate 3b when needed; not in the canonical 11 because it's a where-clause fragment, not a math macro).

### Placeholder convention

A panel whose primary data is **not REAL** must:

1. Prefix the title with `[DATA-GAP]`
2. Render a markdown explanation describing what the panel will show once the data is wired
3. Tag the affected Compass chips as `null` in the sidecar
4. **Not** use `makeresults+random` to fabricate values

---

## Quick reference card

```
COMPUTATION                  MACRO                                    OUTPUT
─────────────────────────────────────────────────────────────────────────────
Availability                 (primitive — read from source)           availability
Retainability                scd_retainability(err, total)            retainability
Quality                      scd_quality_score(p95_ms)                quality
E-Score                      scd_escore(a, r, q, w_a, w_r, w_q)       escore
Uptime SLA                   scd_uptime_sla(avail, target_pct)        uptime_pct, breached
MTTR                         scd_mttr_minutes(duration_s)             mttr_min
Severity → Priority          scd_severity_to_priority(severity)       priority

FILTER                       MACRO                                    USAGE
─────────────────────────────────────────────────────────────────────────────
"real" errors only           scd_errors_filter                        | where `scd_errors_filter`
human users only             scd_human_user_filter                    | where `scd_human_user_filter`

COMPARE-TO                   MACRO                                    OUTPUT
─────────────────────────────────────────────────────────────────────────────
vs 7-day p95                 scd_compare_p95(metric, by)              baseline_p95, delta_from_p95
last-known-good              scd_compare_lkg(metric, by)              lkg, delta_from_lkg
allow-list / threat-intel    scd_compare_allowlist(lookup, key)       is_outside_allowlist
```

That's the full math layer. **11 macros, never more.**
