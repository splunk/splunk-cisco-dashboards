# TA Stock Search Rewrite Report

Total stanzas processed: **100**

| Verdict | Count |
|---|---|
| Keep + detokenize | 59 |
| Delete (drilldown) | 22 |
| Delete (populator) | 19 |

## Per-stanza decisions

| Stanza | sub_category | search_name | Verdict | Reason |
|---|---|---|---|---|
| `ta_te_stock_activity_logs_1314370b0e` | TE Activity Logs | ThousandEyes - Activity Logs - Activity Event Types by Count | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_activity_logs_1d93140d8b` | TE Activity Logs | ThousandEyes - Activity Logs - Activity Audit Log Detail Table | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_activity_logs_2c7adab075` | TE Activity Logs | ThousandEyes - Activity Logs - Activity Volume by User | DELETE_POPULATOR | single tstats aggregate of identifier field — input populator |
| `ta_te_stock_activity_logs_b8ea5fe959` | TE Activity Logs | ThousandEyes - Activity Logs - Account Groups Listing | DELETE_POPULATOR | single tstats aggregate of identifier field — input populator |
| `ta_te_stock_alerts_1464c7a04d` | TE Alerts | ThousandEyes - Alerts - Severity Hourly Trend | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_alerts_1deed6bbf5` | TE Alerts | ThousandEyes - Alerts - Alert Counts by Severity (Filterable) | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_alerts_675e5f5a41` | TE Alerts | ThousandEyes - Alerts - Alert Volume by Account ID | DELETE_POPULATOR | single tstats aggregate of identifier field — input populator |
| `ta_te_stock_alerts_6f5969d333` | TE Alerts | ThousandEyes - Alerts - Recent Alerts Detail Table | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_alerts_70fa2f1e1d` | TE Alerts | ThousandEyes - Alerts - Active Alerts by Severity (Sorted) | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_alerts_ac9a3a6f29` | TE Alerts | ThousandEyes - Alerts - Alert Volume by Test Type | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_application_036afe571b` | TE Application | ThousandEyes - Application - HTTP Server Availability Trend | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_application_0443c39a23` | TE Application | ThousandEyes - Application - HTTP Server Throughput Trend by Server Address | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_application_053f05ef92` | TE Application | ThousandEyes - Application - API Targets by Server Address | DELETE_POPULATOR | single tstats aggregate of identifier field — input populator |
| `ta_te_stock_application_0753a45126` | TE Application | ThousandEyes - Application - Tests by Domain | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_application_0d26a66fd3` | TE Application | ThousandEyes - Application - HTTP Targets by Server Address | DELETE_POPULATOR | single tstats aggregate of identifier field — input populator |
| `ta_te_stock_application_1485566867` | TE Application | ThousandEyes - Application - API Page Load Completion Trend | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_application_20347ac091` | TE Application | ThousandEyes - Application - API Step Duration Drilldown Permalinks | DELETE_DRILLDOWN | contains $app_dd_N$ drilldown placeholder (parent-row value filter) |
| `ta_te_stock_application_28af1c7e78` | TE Application | ThousandEyes - Application - HTTP Server Throughput Trend | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_application_4b56ba6d5b` | TE Application | ThousandEyes - Application - Web-Transaction Transaction Completion Trend | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_application_53c9556871` | TE Application | ThousandEyes - Application - Web-Transaction Transaction Duration Trend by Source Agent | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_application_5627db99df` | TE Application | ThousandEyes - Application - API Step Completion Trend | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_application_73c966adb5` | TE Application | ThousandEyes - Application - API Step Duration Trend by Server Address | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_application_7444b563ff` | TE Application | ThousandEyes - Application - Tests by ID and Name | DELETE_POPULATOR | single tstats aggregate of identifier field — input populator |
| `ta_te_stock_application_82aa2a88d2` | TE Application | ThousandEyes - Application - Web-Transaction Source Agents by ID and Name | DELETE_POPULATOR | single tstats aggregate of identifier field — input populator |
| `ta_te_stock_application_8a2cafa3f1` | TE Application | ThousandEyes - Application - Page Load Targets by Server Address | DELETE_POPULATOR | single tstats aggregate of identifier field — input populator |
| `ta_te_stock_application_a0af69ca77` | TE Application | ThousandEyes - Application - Page Load Duration Trend by Server Address | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_application_a2c4086033` | TE Application | ThousandEyes - Application - Tests by Type | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_application_a81e8f8f09` | TE Application | ThousandEyes - Application - Web-Transaction Transaction Duration Drilldown Permalinks | DELETE_DRILLDOWN | contains $app_dd_N$ drilldown placeholder (parent-row value filter) |
| `ta_te_stock_application_a9f69533bc` | TE Application | ThousandEyes - Application - HTTP Client Duration Drilldown Permalinks | DELETE_DRILLDOWN | contains $app_dd_N$ drilldown placeholder (parent-row value filter) |
| `ta_te_stock_application_ae57e60163` | TE Application | ThousandEyes - Application - Path Visualization Minimum Hop Count by Server | DELETE_DRILLDOWN | contains $app_dd_N$ drilldown placeholder (parent-row value filter) |
| `ta_te_stock_application_b08dc274f0` | TE Application | ThousandEyes - Application - Page Load Duration Drilldown Permalinks | DELETE_DRILLDOWN | contains $app_dd_N$ drilldown placeholder (parent-row value filter) |
| `ta_te_stock_application_b25b1cdd70` | TE Application | ThousandEyes - Application - HTTP Server Throughput Drilldown Permalinks | DELETE_DRILLDOWN | contains $app_dd_N$ drilldown placeholder (parent-row value filter) |
| `ta_te_stock_application_b69a344cb5` | TE Application | ThousandEyes - Application - HTTP Server Availability Drilldown Permalinks | DELETE_DRILLDOWN | contains $app_dd_N$ drilldown placeholder (parent-row value filter) |
| `ta_te_stock_application_d36c3ab14c` | TE Application | ThousandEyes - Application - HTTP Server Availability Trend by Server Address | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_application_e416b5bddd` | TE Application | ThousandEyes - Application - Source Agents by ID and Name | DELETE_POPULATOR | single tstats aggregate of identifier field — input populator |
| `ta_te_stock_application_e5838d5011` | TE Application | ThousandEyes - Application - Account ID Inventory | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_application_f1090d3949` | TE Application | ThousandEyes - Application - HTTP Client Duration Trend by Server Address | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_application_f3d413fb27` | TE Application | ThousandEyes - Application - HTTP Client Duration Trend | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_configuration_status_0366a40321` | TE Configuration | ThousandEyes - Configuration Status - Event Input Source Last Ingest | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_configuration_status_272b572298` | TE Configuration | ThousandEyes - Configuration Status - Distinct Activity Input Sources | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_configuration_status_3a8c63ea73` | TE Configuration | ThousandEyes - Configuration Status - Activity Input Source Last Ingest | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_configuration_status_4ffc3e40ec` | TE Configuration | ThousandEyes - Configuration Status - Test Inventory Detail Table | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_configuration_status_5768ff00b0` | TE Configuration | ThousandEyes - Configuration Status - Account ID Listing | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_configuration_status_5c89215077` | TE Configuration | ThousandEyes - Configuration Status - Distinct Test IDs | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_configuration_status_62738eee7e` | TE Configuration | ThousandEyes - Configuration Status - Distinct Stream IDs | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_configuration_status_79f234edd5` | TE Configuration | ThousandEyes - Configuration Status - Stream IDs Listing | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_configuration_status_9aeef737b3` | TE Configuration | ThousandEyes - Configuration Status - Distinct Event Input Sources | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_events_2f0522f631` | TE Internet Insights | ThousandEyes - Internet Insights - Events by Severity | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_events_38f55ff03e` | TE Internet Insights | ThousandEyes - Internet Insights - Events Detail Table | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_events_76006240f1` | TE Internet Insights | ThousandEyes - Internet Insights - Events by Type | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_events_d5077b28fb` | TE Internet Insights | ThousandEyes - Internet Insights - Events by State | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_network_008a85290d` | TE Network | ThousandEyes - Network - Loss Drilldown Permalinks | DELETE_DRILLDOWN | contains $app_dd_N$ drilldown placeholder (parent-row value filter) |
| `ta_te_stock_network_0f79b2eb23` | TE Network | ThousandEyes - Network - BGP Monitors by Name | DELETE_POPULATOR | single tstats aggregate of identifier field — input populator |
| `ta_te_stock_network_10bc12eafb` | TE Network | ThousandEyes - Network - Lookup Availability Trend by DNS Question | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_network_184983590d` | TE Network | ThousandEyes - Network - BGP Path Change Count Trend by Monitor | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_network_1ff3196959` | TE Network | ThousandEyes - Network - Tests by Type | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_network_32b4823200` | TE Network | ThousandEyes - Network - Loss Trend by Server Address | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_network_4f992b0e7e` | TE Network | ThousandEyes - Network - Latency Drilldown Permalinks | DELETE_DRILLDOWN | contains $app_dd_N$ drilldown placeholder (parent-row value filter) |
| `ta_te_stock_network_58998f6d2f` | TE Network | ThousandEyes - Network - Lookup Duration Trend by DNS Question | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_network_62f6bfff9c` | TE Network | ThousandEyes - Network - Lookup Availability Drilldown Permalinks | DELETE_DRILLDOWN | contains $app_dd_N$ drilldown placeholder (parent-row value filter) |
| `ta_te_stock_network_740586de28` | TE Network | ThousandEyes - Network - BGP Update Volume Drilldown Permalinks | DELETE_DRILLDOWN | contains $app_dd_N$ drilldown placeholder (parent-row value filter) |
| `ta_te_stock_network_7851df8dbf` | TE Network | ThousandEyes - Network - BGP Path Change Count Drilldown Permalinks | DELETE_DRILLDOWN | contains $app_dd_N$ drilldown placeholder (parent-row value filter) |
| `ta_te_stock_network_7d0a974fe2` | TE Network | ThousandEyes - Network - DNS Monitored Question Names | DELETE_POPULATOR | single tstats aggregate of identifier field — input populator |
| `ta_te_stock_network_7de2a79586` | TE Network | ThousandEyes - Network - Tests by Domain | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_network_84d08470c5` | TE Network | ThousandEyes - Network - Targets by Server Address | DELETE_POPULATOR | single tstats aggregate of identifier field — input populator |
| `ta_te_stock_network_9102f05826` | TE Network | ThousandEyes - Network - Loss Trend | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_network_92e342d7e2` | TE Network | ThousandEyes - Network - DNSSEC Validity Drilldown Permalinks | DELETE_DRILLDOWN | contains $app_dd_N$ drilldown placeholder (parent-row value filter) |
| `ta_te_stock_network_95e78dc092` | TE Network | ThousandEyes - Network - DNSSEC Validity Trend by DNS Question | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_network_9b12d104a8` | TE Network | ThousandEyes - Network - BGP Update Volume Trend by Monitor | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_network_9b37dc8315` | TE Network | ThousandEyes - Network - BGP Reachability Geo Map | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_network_9e60a9515e` | TE Network | ThousandEyes - Network - Jitter Trend | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_network_af1b03c0c1` | TE Network | ThousandEyes - Network - Jitter Trend by Server Address | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_network_bbdf29d1ae` | TE Network | ThousandEyes - Network - Account ID Inventory | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_network_d08ed98d04` | TE Network | ThousandEyes - Network - Jitter Drilldown Permalinks | DELETE_DRILLDOWN | contains $app_dd_N$ drilldown placeholder (parent-row value filter) |
| `ta_te_stock_network_d0cddcc657` | TE Network | ThousandEyes - Network - Source Agents by ID and Name | DELETE_POPULATOR | single tstats aggregate of identifier field — input populator |
| `ta_te_stock_network_e763577431` | TE Network | ThousandEyes - Network - Latency Trend | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_network_f6c392b29f` | TE Network | ThousandEyes - Network - Tests by ID and Name | DELETE_POPULATOR | single tstats aggregate of identifier field — input populator |
| `ta_te_stock_network_f8ed52657f` | TE Network | ThousandEyes - Network - Lookup Duration Drilldown Permalinks | DELETE_DRILLDOWN | contains $app_dd_N$ drilldown placeholder (parent-row value filter) |
| `ta_te_stock_network_fbe03c9209` | TE Network | ThousandEyes - Network - Latency Trend by Server Address | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_voice_1e93e2e7e2` | TE Voice | ThousandEyes - Voice - FTP Server Availability Drilldown Permalinks | DELETE_DRILLDOWN | contains $app_dd_N$ drilldown placeholder (parent-row value filter) |
| `ta_te_stock_voice_308dd5408f` | TE Voice | ThousandEyes - Voice - SIP Server Availability Trend by Server Address | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_voice_3899de00a5` | TE Voice | ThousandEyes - Voice - SIP Targets by Server Address | DELETE_POPULATOR | single tstats aggregate of identifier field — input populator |
| `ta_te_stock_voice_4f2e35664c` | TE Voice | ThousandEyes - Voice - RTP Target Agents by Name | DELETE_POPULATOR | single tstats aggregate of identifier field — input populator |
| `ta_te_stock_voice_74e9a74dfe` | TE Voice | ThousandEyes - Voice - Account ID Inventory | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_voice_7933acf03c` | TE Voice | ThousandEyes - Voice - RTP MOS Score Trend by Target Agent | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_voice_852f97b07b` | TE Voice | ThousandEyes - Voice - Tests by Type | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_voice_92ece4e7af` | TE Voice | ThousandEyes - Voice - Tests by ID and Name | DELETE_POPULATOR | single tstats aggregate of identifier field — input populator |
| `ta_te_stock_voice_93dad2e6b8` | TE Voice | ThousandEyes - Voice - FTP Client Duration Trend by Server Address | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_voice_a372319ddc` | TE Voice | ThousandEyes - Voice - FTP Targets by Server Address | DELETE_POPULATOR | single tstats aggregate of identifier field — input populator |
| `ta_te_stock_voice_ab881f10c4` | TE Voice | ThousandEyes - Voice - FTP Server Availability Trend by Server Address | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_voice_b59e8c9367` | TE Voice | ThousandEyes - Voice - FTP Server Throughput Drilldown Permalinks | DELETE_DRILLDOWN | contains $app_dd_N$ drilldown placeholder (parent-row value filter) |
| `ta_te_stock_voice_bd79873929` | TE Voice | ThousandEyes - Voice - SIP Registration Total Time Drilldown Permalinks | DELETE_DRILLDOWN | contains $app_dd_N$ drilldown placeholder (parent-row value filter) |
| `ta_te_stock_voice_bfe226f298` | TE Voice | ThousandEyes - Voice - SIP Registration Total Time Trend by Server Address | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_voice_c07e2d99cc` | TE Voice | ThousandEyes - Voice - FTP Client Duration Drilldown Permalinks | DELETE_DRILLDOWN | contains $app_dd_N$ drilldown placeholder (parent-row value filter) |
| `ta_te_stock_voice_c1fbe9dcab` | TE Voice | ThousandEyes - Voice - SIP Server Availability Drilldown Permalinks | DELETE_DRILLDOWN | contains $app_dd_N$ drilldown placeholder (parent-row value filter) |
| `ta_te_stock_voice_c39387f05a` | TE Voice | ThousandEyes - Voice - Source Agents by ID and Name | DELETE_POPULATOR | single tstats aggregate of identifier field — input populator |
| `ta_te_stock_voice_d43a4d58d4` | TE Voice | ThousandEyes - Voice - FTP Server Throughput Trend by Server Address | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
| `ta_te_stock_voice_dcd99b6544` | TE Voice | ThousandEyes - Voice - RTP MOS Score Drilldown Permalinks | DELETE_DRILLDOWN | contains $app_dd_N$ drilldown placeholder (parent-row value filter) |
| `ta_te_stock_voice_ee1b12f7f0` | TE Voice | ThousandEyes - Voice - SIP Client Duration Drilldown Permalinks | DELETE_DRILLDOWN | contains $app_dd_N$ drilldown placeholder (parent-row value filter) |
| `ta_te_stock_voice_ef3497ee01` | TE Voice | ThousandEyes - Voice - SIP Client Duration Trend by Server Address | KEEP_DETOKENIZE | aggregation / trend / detail table — surviving as standalone |
