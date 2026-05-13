---
name: splunk-spl-searchbase-format
description: Format and validate stanzas added to or modified in packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf. Use when adding a new SPL search, editing an existing one, harvesting searches from upstream apps (e.g., Cisco TA dashboards), or before committing any change that touches searchbase.conf.
---

# searchbase.conf SPL & Metadata Format

`searchbase.conf` is the central catalogue of dispatch-ready SPL for the Splunk Cisco Dashboards app. Every stanza in the file follows the same shape so it can be filtered in the UI, audited from a CSV export, and reviewed without surprises. This skill captures that shape so additions and edits stay consistent.

## Stanza skeleton

Every stanza must include these fields, in this order, with the exact casing shown:

```ini
[stanza_name_lowercase_snake_case]
search_name = <Domain> - <Area> - <Specific Panel Title>
search_author = <github-handle-or-team-id>
updated_author = <github-handle>
version = 1.0.0
date_created = YYYY-MM-DD
date_updated = YYYY-MM-DD
category = <Top-level domain bucket>
sub_category = <Sub-bucket>
tags = <Tag1>,<Tag2>,<Tag3>
dispatch_context = splunk-cisco-dashboards
dispatch_context_force = 1
default_viz = splunk.<viz>            ; only when the stanza drives a viz tile
viz_options = {...}                   ; only when default_viz is set
description = <p>One-paragraph "what this returns" in HTML.</p>
explanation = <p>Multi-paragraph "how the SPL works" in HTML.</p>
solution = <p>"What the consumer should do with this" + Suggested Actions list.</p>
related_info = <ul><li>...</li></ul>  ; cross-links / context notes
search = <SPL, multi-line per the Search field formatting section below>
```

Skip `default_viz` / `viz_options` only when the stanza is purely a backend search (no tile binding).

## Search field formatting

The `search` field uses `\` line continuations. Read [searchbase.conf](../../packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf) for canonical examples and follow the same shape.

### Rules

1. **Every top-level pipe begins a new line.** The continuation marker (`\`) goes on the *previous* line, never on the final line.
2. **`tstats` clauses break onto separate lines:** the aggregate list stays on the `tstats` line; `FROM`, `WHERE`, and `BY` each start their own line, indented 4 spaces.
3. **Multi-condition `WHERE` clauses:** the first filter goes on the `WHERE` line; subsequent filters indent 10 spaces (so they line up under the first filter, not under `WHERE`).
4. **Multi-clause `eval` and `eventstats`:** put one clause per line, comma-separated, with the continuation lines aligned under the first clause.
5. **Subsearches (`[ ... ]`, `append [...]`, `appendcols [...]`):** keep the bracketed body on a single line *within its pipeline segment*. Don't try to wrap inside the brackets.
6. **No tabs.** Use spaces only.
7. **Field name punctuation:** follow [splunk-spl-field-syntax.mdc](../../.cursor/rules/splunk-spl-field-syntax.mdc). Dotted fields are bare in `stats … by`, `rename`, and `BY`, but single-quoted inside `eval(...)`.

### Canonical example

```spl
search = | tstats `summariesonly` avg(Test_Metrics.metric_name:http.server.request.availability) AS avg_avail \
    FROM datamodel="Cisco_ThousandEyes.Test_Metrics" \
    WHERE Test_Metrics.metric_name:http.server.request.availability="*" \
          Test_Metrics.thousandeyes.test.type="http-server" \
    BY _time span=1h, Test_Metrics.server.address, Test_Metrics.thousandeyes.test.name \
| rename Test_Metrics.server.address AS site \
| stats avg(avg_avail) AS site_avail BY _time, site \
| eval available = if(site_avail >= 99.5, 1, 0) \
| timechart span=1h sum(available) AS sites_up, dc(site) AS sites_total \
| eval current_pct = if(sites_total > 0, round(100 * sites_up / sites_total, 1), null()) \
| eventstats avg(current_pct) AS baseline_pct, \
             latest(sites_up) AS latest_up, \
             latest(sites_total) AS latest_total \
| eval display = tostring(latest_up) . " of " . tostring(latest_total) . " available", \
       headline_pct = if(latest_total > 0, round(100 * latest_up / latest_total, 1), null()) \
| fields _time current_pct baseline_pct sites_up sites_total display headline_pct
```

### Anti-pattern (do not commit this)

```spl
search = | tstats `summariesonly` count(Activities.event) as event FROM datamodel="Cisco_ThousandEyes.Activities"  WHERE $tkn_acc_group$ $tkn_user$ BY Activities.event
```

A single very long line is unreadable in code review and in the .conf file. Always break per the rules above.

## Metadata rules

### `category` and `sub_category`

- `category` is the top-level domain bucket. The vocabulary today is **Building**, **Customer Experience**, **Executive**, **IT Health**, **Monitoring**, **Network**, **Reference**, **Security**.
- `sub_category` is the sub-bucket inside that category. Use **spaces, not underscores** (e.g., `Internet Insights`, not `Internet_Insights`).
- Match an existing `(category, sub_category)` pair when the stanza fits one. Don't invent new buckets unless the stanza genuinely belongs in a new one — and if you do, add it to the catalogue intentionally.

### `tags`

Tags are the primary fast-filter signal in the UI. Treat them as **what would I search for to find this stanza?**

- **Use spaces, not underscores.** `Catalyst Center`, not `Catalyst_Center`. `IT Health`, not `IT_Health`.
- **Subject tags are plural; intent tags are singular.**
  - **Subject** (what the search is *about* — a class of entities the search counts/lists/groups): `Alerts`, `Sites`, `Clients`, `Devices`, `Issues`, `Sessions`, `Events`, `Traces`, `Transactions`. Do not commit `Alert`, `Site`, `Client`, `Trace`, `Transaction`.
  - **Intent / shape** (what the panel *looks like*): `Trend`, `Detail`, `Drilldown`, `KPI`, `Map`, `Bar`, `Pie`, `Table`, `Comparison`, `Distribution`, `Breakdown`, `Leaderboard`. Do not invent variants like `Bar Chart`, `Pie Chart`, `Timechart` (`Timechart` is the SPL command — the panel shape is `Trend`).
  - **Acronyms and protocols stay as-is** regardless of plurality: `BGP`, `DNS`, `ISE`, `XDR`, `RTP`, `SIP`.
- **One canonical name per concept.** Do not commit aliases that mean the same thing as an existing tag:
  - `Catalyst Center`, never `DNAC` (DNAC is the legacy name).
  - `User Experience`, never `UX`.
  - `Cisco Spaces`, never bare `Spaces`.
  - `Map`, never `Geographic` or `Geolocation` (use `Geo Enriched` only when the data has been joined to a geo lookup and the SPL output shape reflects that).
- **No noise tags.** Do not add `Cisco`, `Accelerated`, `Cisco_TA`, `TEUC`, `Migrated_From_SavedSearch`, `Composite_Replacement`, capability flags like `Requires_Cisco_ThousandEyes_DM` / `Requires_Cisco_ThousandEyes_Alerts_DM`, vague single-word tags like bare `IT` (use `IT Health` instead), implementation noise like `Macros` / `Index` / `Pipeline`, demo provenance like `Demo` / `Tallahassee` / `Auburndale` / `Statewide`, or generic verbs like `Report` / `Reporting`. The dependency or context belongs in `description` / `explanation`, not the filterable tag set.
- **Be specific.** A bar-chart panel of TE alerts by severity should be tagged `Alerts,ThousandEyes,Severity,Bar`, not `ThousandEyes,Alerts`.
- **Provenance is fine.** `TA Stock Dashboard` is a useful tag to mark stanzas harvested from upstream TA dashboards because consumers may want to filter for or against them. `ESCU`, `ITSI` are also acceptable provenance tags.

### `search_name`

`search_name` is the user-facing title in the UI. Format:

```
<Domain> - <Area> - <Specific Title>
```

- **Domain** is one of `ThousandEyes`, `Catalyst Center`, `Meraki`, `ISE`, `XDR`, `Cisco Spaces`, `Florida`, `Executive Dashboard`, etc.
- **Area** is the functional grouping (`Network`, `Voice`, `Activity Logs`, `Internet Insights`, `Critical Sites`).
- **Specific Title** describes the panel: what shape, what metric, what dimension.

Example: `ThousandEyes - Voice - FTP Server Throughput Drilldown Permalinks`.

If a stanza is going to drive a tile already named in a dashboard XML, mirror that tile name verbatim in `search_name`.

## When you add or modify a stanza

1. Match the exact field order and casing in the [Stanza skeleton](#stanza-skeleton) above.
2. Run the SPL through the [Search field formatting](#search-field-formatting) rules.
3. Pick `category` / `sub_category` from the existing taxonomy — if the new stanza doesn't fit, raise it before merging.
4. Set 3–6 specific, space-separated tags following [`tags` guidance](#tags).
5. Bump `date_updated` and `updated_author` (leave `date_created` / `search_author` unchanged for existing stanzas).
6. If the SPL is non-trivial, write the `explanation` so a junior engineer can read the SPL without help: name the data model / sourcetype, name each pipe stage, name each output field.
7. Bump `app.conf`'s `build` (and `version` if appropriate) when shipping the change.

## When you harvest a search from an upstream TA

When pulling a search from `ta_cisco_thousandeyes` (or another upstream add-on):

1. Keep the SPL byte-identical (modulo whitespace) — do not rewrite logic during harvest.
2. Apply the [Search field formatting](#search-field-formatting) rules so the harvested SPL matches every other stanza.
3. Set `search_name` from the SPL signature (test type, metric, shape) — not from the upstream view filename.
4. Set `tags` from the SPL signature, plus `TA Stock Dashboard` for provenance.
5. Set `sub_category` to a TE-specific bucket (e.g., `TE Activity Logs`, `TE Alerts`, `TE Network`, `TE Voice`) — do not lump everything under a single `ThousandEyes` sub-category.
6. Note the upstream view in `description` (`activity_logs.xml`, `alerts.xml`, etc.).

## Cross-references

- [splunk-spl-field-syntax.mdc](../../.cursor/rules/splunk-spl-field-syntax.mdc) — when to single-quote dotted field names
- [splunk-cisco-thousandeyes-fields.mdc](../../.cursor/rules/splunk-cisco-thousandeyes-fields.mdc) — authoritative TE field dictionary
- [splunk-data-model-discovery.mdc](../../.cursor/rules/splunk-data-model-discovery.mdc) — how to discover DM-eligible fields
- [splunk-cisco-dnac-fields.mdc](../../.cursor/rules/splunk-cisco-dnac-fields.mdc) — DNAC field reference
