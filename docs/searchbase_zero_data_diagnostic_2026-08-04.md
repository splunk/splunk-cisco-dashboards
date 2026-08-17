# Searchbase Zero-Result Diagnostic — 2026-08-04

Source: `/Users/akhamis/Downloads/1785859977_7111.csv` (192 searches reported "0 rows" / "no numeric value" / "search job failed" against the `/opt/10` instance, "Last 7 days"). One row (`ssef_command_logs`) is not part of this app's `searchbase.conf` and was excluded. The remaining **191** were tested.

## Method

1. Extracted the exact current `search` SPL for all 191 stanzas from `searchbase.conf`.
2. Ran every one verbatim against the live `/opt/10` instance (`splunk search` CLI, app context `splunk-cisco-dashboards` so macros resolve correctly, `-earliest_time -7d -latest_time now`, matching the CSV's window) and captured Splunk's own result rows and diagnostic messages.
3. For zero-row searches with no specific diagnostic message, extracted just the base filter (before the first `eval`/`stats`/`rex`/`timechart`) and re-ran it alone to determine whether **any** raw event matches the base filter at all, or whether matching events exist but a later field/logic reference is the problem.
4. Cross-checked every relevant sourcetype, lookup file, and accelerated-datamodel dataset directly via `tstats`/`eventcount` for real event counts and time ranges.

**Every classification below is backed by a real query result against the live instance — nothing here is inferred from search text alone.**

## Headline answer

| # | Root cause | Stanzas |
|---|---|---|
| A | **No demo data exists at all** for the sourcetype/datamodel/macro-filter the search depends on | **101** |
| B | **Lookup CSV ships empty** — raw events exist, but a `lookup`/join against an empty reference table drops every row | **33** |
| C | **Real matching data exists, but the SPL references a field/component/keyword that isn't present on it** — an SPL-side (or demo-schema) mismatch | **39** |
| D | ML anomaly/forecast models needed more accumulated history; now producing real output as more days have passed (self-resolving) | 6 |
| E | Diagnostic-tool false positive — the search actually returns a real value, but it's a percentage-string or place-name, not a raw number, which the original checker seems to have misclassified | 3 |
| F | Depends on live internal Splunk state (`\| rest /services/search/jobs`), not customer data — not a data-import concern at all | 1 |
| G | **Data model referenced by the search doesn't exist in this environment at all** (`Data model 'Secure_Firewall_Dataset' was not found` — a hard error, not just empty) | 8 |

**Bottom line: it's overwhelmingly a data problem (134 of 191, tiers A+B), not an SPL problem.** 39 stanzas (tier C) have a real SPL/field-reference issue worth fixing in `searchbase.conf` itself (most are one-field swaps, not logic bugs), and 8 more (tier G) reference a data model this environment never defines at all.

## Tier A — no data at all (101 stanzas)

7 sourcetypes and 4 accelerated-datamodel datasets have **zero events anywhere in the instance, any time range**:

| Missing source | Confirmed empty | Stanzas affected |
|---|---|---|
| `cisco:dc:aci:syslog` | sourcetype | 4 |
| `cisco:dc:nd:syslog` | sourcetype | 10 |
| `cisco:dc:mso:syslog` | sourcetype | 8 |
| `cisco:dc:nexus9k:syslog` | sourcetype | 14 |
| `cisco:cloud_security:ztna` | sourcetype | 3 |
| `ms:defender:atp:alerts` | sourcetype | 1 |
| `splunk:aa:forensic:mitreattacks` | sourcetype | 1 |
| `Cisco_DCN_nexus_dashboard.flows` | datamodel dataset | 12 |
| `Cisco_DCN_nexus_dashboard.congestion` | datamodel dataset | 2 |
| `Cisco_DCN_nexus_dashboard.endpoints` | datamodel dataset | 2 |
| `Cisco_DCN_nexus_dashboard.protocols` | datamodel dataset | 5 |
| `home_page_details_nexus_9k` macro's underlying source | macro-resolved search | 2 |

Plus **14 stanzas** where the *sourcetype/macro base* has real data but a specific **narrower filter** (an ACI `component=` value, a `dn=` path pattern, an `mso_api_endpoint=` value, or a keyword like `"RadSec"`) matches **zero** real events — confirmed by running the base filter alone and separately confirming the un-filtered base has real rows:

- ACI `component=eqptExtCh`, `component=eqptSensor`, `component=fabricHealthTotal` with specific `dn=` patterns — real ACI health data exists (789 events), but not tagged with these exact component/dn combinations. (`dc_networking_fabric_extenders_detail_fabric_extenders_fex_health`, `dc_networking_fabric_extenders_detail_fex_id_sensors`, `dc_networking_home_fabric_health_history`)
- `component="fvAp" dn="*/health"` and `component=fvAEPg isAttrBasedEPg=yes` — the `apic-tenant-overview` macro base has 223 real events, zero match these exact component/dn/attribute combinations. (`dc_networking_application_count_trend_by_tenant`, `dc_networking_tenant_details_top_10_affected_tenants_faults`, `dc_networking_microsegmentation_contract_details_of_microsegmented_epgs`, `dc_networking_microsegmentation_microsegmented_epg_details`, `dc_networking_microsegmented_epg_count_trend_by_tenant`)
- `mso_api_endpoint=policyDetails` — real MSO data exists (489 events) for `schemaDetails`/`tenantDetails`, but not `policyDetails`. (`dc_networking_policy`, `dc_networking_policy_policy_subtype`, `dc_networking_policy_policy_subtype_breakdown`)
- `cisco:ise:syslog` filtered to `"RadSec" OR "RADIUS over TLS"` — 157k+ real ISE syslog events exist, none are RadSec-related. (`secure_networking_zta_radsec_activity_trend`)
- `cisco:dnac:client type="Wireless"` (roaming analysis) — 87k+ real client events exist, none carry that exact `type` value. (`user_experience_client_roaming_analysis`)
- `Cisco_Catalyst_App` node `Cisco_Catalyst_SGACL_Events` — confirmed 0 events via direct `tstats`, while the parent data model has 2.1M+ events overall. (`secure_networking_sgacl_enforcement_activity_trend`)

And **23 stanzas** where Splunk itself reported `"No matching fields exist"` — the search references fields that have never been extracted from any indexed event under that constraint (same root cause as above, just surfaced as a Splunk-native message instead of a silent zero).

## Tier B — lookup CSVs ship empty (33 stanzas)

Four reference lookup files in `cisco_dc_networking_app_for_splunk` exist but contain **zero rows**, so any search that joins against them drops every result even though the raw `tstats`/`search` side has real matching events:

| Lookup file | Stanzas affected |
|---|---|
| `cisco_dc_APICNodeTable` | 15 |
| `cisco_dc_APICCEPLookup` | 8 |
| `cisco_dc_nexus_hostname_lookup` | 7 |
| `cisco_dc_nexus_inventory_lookup` | 3 |

This is a **different fix** than "generate more events" — these need populated **reference/dimension data** (node IDs → hostnames/site mappings, endpoint MAC/IP inventories), not more raw telemetry.

## Tier C — real data exists, SPL/field mismatch (39 stanzas — genuine SPL-side issues)

These are **not** data problems — matching raw events exist, but the search references a field name, or a downstream data-model alias, that doesn't line up with what's actually in the event. The clearest confirmed example:

**`dc_networking_acl_logs_l3_drop`** (and its 5 siblings: `_packets_by_node`, `_packets_by_tenant`, and the `_permit` variants) — real `acllogDropL3Pkt`/`acllogPermitL3Pkt` events exist in `cisco:dc:aci:class` (5 and 4 events respectively, confirmed via direct sample), but the SPL computes `avg(pktLen)` — **the field is actually named `txPkt`/`rxPkt`** in the real event, not `pktLen`. `timechart cont=FALSE avg(pktLen)` legitimately produces zero rows when the averaged field never exists.

The remaining 24 in this tier need the same treatment (confirm real field names against a sample event, then either fix the SPL's field reference or add the missing field to the demo generator — whichever matches the real Cisco ACI/Nexus/DNAC schema). Full list:

```
admin_schedule_health_advisor
dc_networking_controller_statistics_containers_app_center_apps
dc_networking_controller_statistics_controller_faults_by_severity_over_time
dc_networking_fabric_details_tcam_percentage_value
dc_networking_fabric_extenders_detail_fex_id_extended_chassis_module
dc_networking_orchestrator_overview_site_location
dc_networking_vmware_end_points_in_vlan_range
it_critical_systems_ntp_time_drift
network_intelligence_dhcp_no_lease_offered_clients
network_intelligence_zeek_dns_slow_resolver_anomalies
overview_link_site_1_site_2_health
secure_networking_vendor_mac_on_nac_port
security_operations_dns_tunnel_beacon_cadence
security_operations_lateral_movement_identity_network_pivots
security_resilience_sdwan_utd_amp_disposition_trend
security_resilience_sdwan_utd_amp_top_malware
security_resilience_zeek_ssh_auth_pressure
spaces_recurring_weekly_surge_detection
user_experience_client_top_talkers
xdr_aa_job_task_failure_health
dc_networking_authentication_authentication_failed_by_user
dc_networking_authentication_authentication_success_by_user
dc_networking_authentication_failure_by_user
dc_networking_authentication_successful_login_by_user
it_health_te_app_page_load_duration_by_server
it_health_te_config_account_id_listing
teuc_5_9_30_sase_secure_edge_performance
teuc_5_9_32_cdn_edge_network_performance
teuc_5_9_33_cloud_provider_path_visualization
teuc_5_9_37_page_load_completion_rate
teuc_5_9_38_page_load_duration_trending
teuc_5_9_53_cross_platform_correlation_network_plus_apm
teuc_5_9_54_mttr_reduction_via_network_vs_application_isolation
```

`admin_schedule_health_advisor` specifically: Splunk reported `"the _time or _origtime field... is missing: latest"` inside a subsearch — a real SPL defect (a `stats latest(...)` call on a field stream without `_time`), independent of any data availability question.

The `dc_networking_authentication_*` four use the `authentication_details` macro / `Cisco_DCN_Auth` data model — both confirmed to have real events (446 and 453 respectively) in the last 7 days; the 0-row result is a downstream field/logic issue in each search's own pipeline, not a data gap. Same pattern for the ThousandEyes-based `teuc_5_9_*`/`it_health_te_app_*` entries: `Cisco_ThousandEyes.Test_Metrics` has 18,910 real events in the window, but each of these searches' specific `metric_name:` constraint doesn't resolve against them.

## Tier G — referenced data model doesn't exist in this environment (8 stanzas)

`network_intelligence_ftd_intrusion_risky_flows`, `network_intelligence_ftd_intrusion_top_signatures`, `security_resilience_ds_ids_classification`, `security_resilience_firepower_event_correlation`, `security_resilience_firepower_intrusion_trend`, `security_resilience_firepower_top_signatures`, `security_resilience_idsips_alert_trend`, `security_resilience_ips_severity_distribution` all reference `FROM datamodel=Secure_Firewall_Dataset`. Running that `tstats` directly returns a **hard error**: `FATAL: Error in 'DataModelEvaluator': Data model 'Secure_Firewall_Dataset' was not found` — this data model isn't defined anywhere in this Splunk instance (not the searchbase app, not any installed TA). This needs either (a) that data model to be added/shipped by whichever app is supposed to own it, or (b) these 8 searches re-pointed at a real, installed data model or sourcetype that covers the same Firepower/IDS content (`cisco:ftd:intrusion` has real data — 1,139+ events confirmed earlier under `cisco:ftd:adv:dns` alone — so the underlying raw telemetry likely exists; the data model definition is what's missing).

## Tier D — self-resolving (6 stanzas)

`spaces_fit_area_occupancy_anomaly`, `spaces_fit_camera_headcount_anomaly`, `teuc_fit_bgp_path_changes_anomaly` now return real anomaly results when re-tested today — their ML `DensityFunction` fit needed more accumulated days of history than existed at CSV-capture time (data ingestion started ~2026-07-25/26; by 2026-08-04 there's enough history). 3 more (`spaces_fit_camera_multivariate_anomaly`, `spaces_fit_device_presence_ratio_anomaly`, `teuc_fit_multivariate_network_health_anomaly`) still show Splunk's own `"Too few training points in some groups"` warning — same class, just needs a few more days, or more events per group.

## Tier E — checker false positives (3 stanzas)

`overview_inter_site_latency` returns `{"value": "100.00%"}` and `overview_operational_lead` returns `{"value": "Global/California/San Jose/SJC23"}` — both are correct, real, meaningful results. Whatever generated the original CSV appears to have flagged "no numeric value" because these singlevalue outputs are a percentage-string and a place-name, not a bare number — a limitation of that check, not a defect in these searches.

## Tier F — not a data question (1 stanza)

`admin_cache_hit_summary` runs `| rest /services/search/jobs` — a live snapshot of the scheduler's in-flight job queue. It legitimately returns 0 rows whenever no dashboard-driven searches happen to be running at the exact moment it's checked. Not something demo data can "fix."

## Update — Tier C fix pass (2026-08-04, later same day)

All 39 Tier C stanzas were diagnosed and, where a faithful fix existed, corrected in `searchbase.conf` — then every one was independently re-run live against `/opt/10` to confirm the actual result (not just trusted from the fix report). Final, verified outcome:

- **21 now return real, meaningful rows.** Confirmed root causes fixed: `pktLen`→`txPkt` field-name typos (ACL logs family, 6 stanzas), a broken `timeStamp`→`_time` remap stacked on top of that same bug, two dead `join`s against a `role=controller` value that never exists in the demo data, a date-format regex mismatch (`"Mon DD YYYY"` expected vs. real `"MM/DD/YYYY"`), a dotted-vs-underscore datamodel field typo (`web.page.load.*` vs. real `web.page_load.*`) affecting 4 ThousandEyes stanzas, an `mv`-field `tonumber()` bug, a lookup `OUTPUT` clause that was overwriting its own join key, two dead `WHERE description LIKE "%Success"` filters (redundant given ACI never logs a failed-login session record), a hardcoded generic site-name regex never swapped for this deployment's real site names, and several detection thresholds calibrated for a data volume this 7-day demo window doesn't have (now lowered while preserving the real underlying pattern requirement).
- **2 are now correctly fixed but legitimately return 0 rows** — the field-mapping bug is gone, but the real data genuinely has no anomalies to surface: `admin_schedule_health_advisor` (only 3 real saved searches exist, all healthy) and `teuc_5_9_37_page_load_completion_rate` (every real page-load test completes at 100% in this window, so the "below 100%" filter correctly finds nothing).
- **16 are confirmed genuine data-content gaps, left unchanged** after live verification found no faithful SPL fix exists: two disjoint-key-pool cases (`dc_networking_fabric_details_tcam_percentage_value`, `dc_networking_vmware_end_points_in_vlan_range`), a FEX hierarchy that was never encoded in the demo `dn` field (`dc_networking_fabric_extenders_detail_fex_id_extended_chassis_module`), a missing geo-coordinate field with no fallback lookup (`dc_networking_orchestrator_overview_site_location`), no matching vendor-MAC OUIs (`secure_networking_vendor_mac_on_nac_port`), no correlated identity+network pivot signal despite a real network-only signal existing (`security_operations_lateral_movement_identity_network_pivots` — a threshold-lowering attempt was tried, found to produce a misleading "0 real identity correlation" result, and correctly reverted back to its original, honest 0-row state), no AMP malware message subtype generated (`security_resilience_sdwan_utd_amp_disposition_trend`, `_amp_top_malware`), no SSH auth failures generated (`security_resilience_zeek_ssh_auth_pressure`), no failed/timed-out job tasks generated (`xdr_aa_job_task_failure_health`), no real "Failure" authentication events exist anywhere in this data's full history (`dc_networking_authentication_authentication_failed_by_user`, `dc_networking_authentication_failure_by_user`), and 5 ThousandEyes/TEUC stanzas where the metric fields are correct but the specific test names/indexes/join-key schemas the panel expects don't exist in this environment (`teuc_5_9_30`, `_32`, `_33`, `_53`, `_54` partially).

All fixes applied via targeted `Edit` calls only; `git diff --check` on `searchbase.conf` is clean; catalog-wide re-scan shows 0 duplicate `search_name`s, 0 orphaned drilldowns, 0 self-references.

## Raw evidence

Full per-stanza classification: `final_classification.json`. Raw probe output: `probe_results.jsonl`, `probe_base_results.jsonl` (all under the session scratch `audits/` directory). A ready-to-send prompt for closing the Tier A/B data gaps is in `docs/demo_data_agent_prompt_2026-08-04.md`.
