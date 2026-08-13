# Searchbase archive audit — 2026-08-05

## Current status — 2026-08-13

- Moved all 156 archived stanzas into `searchbase.conf` and listed them under
  `developing.searchbaseStanzas` in `build-profile-manifest.json`.
- Removed `searchbase.bak`. The build manifest now tracks whether a Searchbase
  stanza is developing or released.
- Replaced the archive regression test with build-profile integrity checks.

The remaining sections document the original archive decision and are retained
for historical context.

## Outcome

- Audited all 64 stanzas that were already present in `searchbase.bak`.
- Confirmed that none were referenced by a Dashboard Studio or classic
  dashboard, an Insights Workspace, or a live Searchbase drilldown.
- Reviewed 100 supplied candidates that were still live.
- Archived 92 candidates with no runtime connection.
- Preserved 8 live drilldown targets for repair rather than archiving them.
- Confirmed that `ssef_command_logs` was absent from both app-owned registry
  files. The installed Splunk Enterprise instance has a separate custom copy in
  `/opt/10/etc/apps/searchbase/local/searchbase.conf`; it is outside this app
  and was intentionally left untouched.
- The final registry contains 1,079 live stanzas and 156 archived stanzas, with
  no duplicate stanza IDs across the two files.

## Preserved searches and callers

| Preserved search | Why it was preserved |
| --- | --- |
| `catalyst_center_wips_active_rogue_threats` | Drilldown target of `catalyst_center_wips_high_severity_rogue_count` |
| `overview_inter_site_latency` | Drilldown target of `overview_active_critical_alerts` |
| `security_resilience_ds_ids_classification` | Drilldown target of `security_resilience_idsips_alert_count`, `security_resilience_idsips_alert_trend`, `security_resilience_ips_severity_distribution`, and `security_resilience_ds_sdwan_utd` |
| `security_resilience_firepower_event_correlation` | Pre-archive drilldown target of `security_resilience_firepower_intrusion_trend` and `security_resilience_firepower_top_signatures`; both callers were archived in this pass |
| `security_resilience_sdwan_utd_amp_top_malware` | Pre-archive drilldown target of `security_resilience_sdwan_utd_amp_disposition_trend`; the caller was archived in this pass |
| `spaces_fit_camera_multivariate_anomaly` | Drilldown target of `spaces_predict_camera_headcount_24h_forecast` |
| `teuc_5_9_37_page_load_completion_rate` | Drilldown target of `teuc_5_9_38_page_load_duration_trending` |
| `teuc_fit_multivariate_network_health_anomaly` | Drilldown target of `teuc_predict_network_latency_forecast` |

No supplied candidate was directly referenced by a dashboard or by
`insights_workspaces.conf`. The eight searches above remain live because their
Searchbase display names were configured as drilldown destinations during the
pre-archive audit. Two now have no live callers because all of their callers
were archived in the same pass; they remain live deliberately under the
preserve-on-link rule and can be reviewed with the other repairs.

## Regression protection

`tests/test_build_profile_searchbase_integrity.py` checks that:

- `searchbase.bak` does not return;
- developing stanza IDs are unique and exist in `searchbase.conf`;
- released runtime resources and drilldowns do not depend on developing
  Searchbase searches; and
- a developing stanza cannot continue supplying a tile configured by
  `insights_workspaces.conf` through `viz_options.overview` metadata.
