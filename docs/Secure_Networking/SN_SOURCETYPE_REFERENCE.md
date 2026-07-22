# SCAN Product Catalog — Secure Networking GTM Cross-Reference

Full extract of every `~/repo/splunk-cisco-app-navigator` `products.conf` stanza flagged `secure_networking_gtm=true` or with a `gtm_pillar` set, as of 2026-07-20. Generated from a direct parse of the conf file — re-derive if the catalog changes rather than trusting this as current forever.

**Caveat on `gtm_pillar`:** uses Cisco's official GTM taxonomy (1 Secure Campus & Branch, 2 Secure WAN Edge, 3 Data Center & Cloud, 4 End-to-End Visibility & Assurance, 5 Industrial/OT), NOT Chris's deck pillars (ZTA/Secure Infrastructure/Segmentation/Hybrid Mesh Firewalling/Agentic Ops). Don't conflate the two — see the Risks section of `SN_EVENT_SCOPING.md`.

| Product | Status | Support level | Coverage gap | Gap type | GTM pillar | Addon (Splunkbase UID) | Viz app (UID) | Sourcetypes |
|---|---|---|---|---|---|---|---|---|
| `cisco_appdynamics` | active | developer_supported | true | rebuild | 4 | Splunk_TA_AppDynamics (3471) |  | appdynamics_analytics, appdynamics_audit, appdynamics_custom_metrics, appdynamics_databases, appdynamics_events, appdynamics_hardware, appdynamics_licenses, appdynamics_security, appdynamics_snapshots ...(truncated) |
| `cisco_webex` | active | developer_supported | true | rebuild | 3 | ta_cisco_webex_add_on_for_splunk (8365) |  | cisco:webex:admin:audit:events, cisco:webex:call:detailed_history, cisco:webex:contact:center, cisco:webex:contact:center:aar, cisco:webex:contact:center:asr, cisco:webex:contact:center:car, cisco:web ...(truncated) |
| `cisco_access_points` | active | cisco_supported |  |  |  | TA_cisco_catalyst (7538) | cisco-catalyst-app (7539) | cisco:ios, cisco:ios:traceback, cisco:telemetry |
| `cisco_aci` | active | cisco_supported |  |  |  | cisco_dc_networking_app_for_splunk (7777) |  | cisco:dc:aci:authentication, cisco:dc:aci:class, cisco:dc:aci:health, cisco:dc:aci:managed_object, cisco:dc:aci:stats, cisco:dc:aci:syslog |
| `cisco_ai_defense` | active | cisco_supported |  |  |  | CiscoSecurityCloud (7404) |  | cisco:ai:defense, cisco:ai:defense:notable |
| `cisco_asr` | active | cisco_supported |  |  |  | TA_cisco_catalyst (7538) | cisco-catalyst-app (7539) | cisco:ios, cisco:ios:traceback, cisco:telemetry |
| `cisco_catalyst_center` | active | cisco_supported |  |  |  | TA_cisco_catalyst (7538) | cisco-catalyst-app (7539) | cisco:catalyst:center:compliance:report, cisco:catalyst:center:inventory:report, cisco:catalyst:center:report, cisco:dnac:application:traffic, cisco:dnac:audit:logs, cisco:dnac:client, cisco:dnac:clie ...(truncated) |
| `cisco_catalyst_sdwan` | active | cisco_supported |  |  |  | TA_cisco_catalyst (7538) | cisco-catalyst-app (7539) | cisco:sdwan:acl:logs, cisco:sdwan:alert:off, cisco:sdwan:alert:on, cisco:sdwan:audit:logs, cisco:sdwan:block:host, cisco:sdwan:dmi:cli:engine:write:fail, cisco:sdwan:drop:pkt, cisco:sdwan:energy:stats ...(truncated) |
| `cisco_catalyst_switches` | active | cisco_supported |  |  |  | TA_cisco_catalyst (7538) | cisco-catalyst-app (7539) | cisco:ios, cisco:ios:traceback, cisco:telemetry |
| `cisco_cloudlock` | active | cisco_supported |  |  |  | TA-cisco-cloud-security-addon (7569) | cisco-cloud-security (5558) | cisco:cloud_security:cloudlock |
| `cisco_crs` | active | cisco_supported |  |  |  | TA_cisco_catalyst (7538) | cisco-catalyst-app (7539) | cisco:ios, cisco:ios:traceback, cisco:telemetry |
| `cisco_cyber_vision` | active | cisco_supported |  |  |  | TA_cisco_catalyst (7538) | cisco-catalyst-app (7539) | cisco:cybervision:activities, cisco:cybervision:components, cisco:cybervision:devices, cisco:cybervision:events, cisco:cybervision:flows, cisco:cybervision:syslog, cisco:cybervision:vulnerabilities |
| `cisco_duo` | active | cisco_supported |  |  |  | CiscoSecurityCloud (7404) |  | cisco:duo, cisco:duo:*, cisco:duo:account, cisco:duo:activity, cisco:duo:administrator, cisco:duo:authentication, cisco:duo:authentication_v2, cisco:duo:endpoint, cisco:duo:telephony, cisco:duo:teleph ...(truncated) |
| `cisco_esa` | active | splunk_supported |  |  |  | Splunk_TA_cisco-esa (1761) |  | cisco:esa:amp, cisco:esa:antispam, cisco:esa:authentication, cisco:esa:bounce, cisco:esa:cef, cisco:esa:content_scanner, cisco:esa:delivery, cisco:esa:error_logs, cisco:esa:http, cisco:esa:legacy, cis ...(truncated) |
| `cisco_etd` | active | cisco_supported |  |  |  | CiscoSecurityCloud (7404) |  | cisco:etd |
| `cisco_evm` | active | cisco_supported |  |  |  | CiscoSecurityCloud (7404) |  | cisco:evm:file_activity, cisco:evm:process_activity, cisco:evm:registry_key_activity, cisco:evm:registry_value_activity, cisco:evm:windows_service_activity |
| `cisco_identity_intelligence` | active | cisco_supported |  |  |  | CiscoSecurityCloud (7404) |  | cisco:cii |
| `cisco_intersight` | active | cisco_supported |  |  |  | Splunk_TA_Cisco_Intersight (7828) |  | cisco:intersight:advisories, cisco:intersight:alarms, cisco:intersight:auditrecords, cisco:intersight:compute, cisco:intersight:contract, cisco:intersight:contracts, cisco:intersight:custom:inventory, ...(truncated) |
| `cisco_ise` | active | cisco_supported |  |  |  | TA_cisco_catalyst (7538) | cisco-catalyst-app (7539) | cisco:ise:analytics, cisco:ise:analytics:applications, cisco:ise:analytics:fullreport, cisco:ise:analytics:hardware, cisco:ise:analytics:registry, cisco:ise:radius:authz:policy, cisco:ise:radius:polic ...(truncated) |
| `cisco_isovalent` | active | cisco_supported |  |  |  | CiscoSecurityCloud (7404) |  | cisco:isovalent, cisco:isovalent:alert, cisco:isovalent:processconnect, cisco:isovalent:processexec, cisco:isovalent:telemetry:network, cisco:isovalent:telemetry:process |
| `cisco_isovalent_edge_processor` | active | cisco_supported |  |  |  | CiscoSecurityCloud (7404) |  | cisco:isovalent:edge_processor, cisco:isovalent:edge_processor:alert, cisco:isovalent:edge_processor:processconnect, cisco:isovalent:edge_processor:processexec, cisco:isovalent:edge_processor:telemetr ...(truncated) |
| `cisco_isr` | active | cisco_supported |  |  |  | TA_cisco_catalyst (7538) | cisco-catalyst-app (7539) | cisco:ios, cisco:ios:traceback, cisco:telemetry |
| `cisco_meraki` | active | cisco_supported |  |  |  | Splunk_TA_cisco_meraki (5580) |  | meraki:accesspoints, meraki:airmarshal, meraki:apirequestshistory, meraki:apirequestsoverview, meraki:apirequestsresponsecodes, meraki:appliancesdwanstatistics, meraki:appliancesdwanstatuses, meraki:a ...(truncated) |
| `cisco_multicloud_defense` | active | cisco_supported |  |  |  | CiscoSecurityCloud (7404) |  | cisco:multicloud:defense, cisco:multicloud:defense:appid, cisco:multicloud:defense:auditlogs, cisco:multicloud:defense:av, cisco:multicloud:defense:dlp, cisco:multicloud:defense:dpi, cisco:multicloud: ...(truncated) |
| `cisco_nexus` | active | cisco_supported |  |  |  | cisco_dc_networking_app_for_splunk (7777) |  | cisco:dc:nexus9k, cisco:dc:nexus9k:dme, cisco:dc:nexus9k:syslog |
| `cisco_nexus_dashboard` | active | cisco_supported |  |  |  | cisco_dc_networking_app_for_splunk (7777) |  | cisco:dc:mso:syslog, cisco:dc:nd:advisories, cisco:dc:nd:anomalies, cisco:dc:nd:congestion, cisco:dc:nd:endpoints, cisco:dc:nd:flows, cisco:dc:nd:mso, cisco:dc:nd:protocols, cisco:dc:nd:syslog |
| `cisco_nvm` | active | cisco_supported |  |  |  | CiscoSecurityCloud (7404) |  | cisco:nvm:eve:v2, cisco:nvm:flowdata:v2, cisco:nvm:ifdata:v2, cisco:nvm:osquery:v2, cisco:nvm:processinfodata:v2, cisco:nvm:sysdata:v2 |
| `cisco_secure_access` | active | cisco_supported |  |  |  | TA-cisco-cloud-security-addon (7569) | cisco-cloud-security (5558) | cisco:cloud_security:appdiscovery, cisco:cloud_security:audit, cisco:cloud_security:dlp, cisco:cloud_security:dns, cisco:cloud_security:fileevent, cisco:cloud_security:firewall, cisco:cloud_security:i ...(truncated) |
| `cisco_secure_cloud_analytics` | active | cisco_supported |  |  |  | CiscoSecurityCloud (7404) |  |  |
| `cisco_secure_endpoint` | active | cisco_supported |  |  |  | CiscoSecurityCloud (7404) |  | cisco:se |
| `cisco_secure_firewall` | active | cisco_supported |  |  |  | CiscoSecurityCloud (7404) |  | cisco:asa, cisco:ftd:syslog, cisco:sfw:estreamer, cisco:sfw:policy |
| `cisco_secure_malware_analytics` | active | cisco_supported |  |  |  | CiscoSecurityCloud (7404) |  | cisco:sma:submissions |
| `cisco_secure_network_analytics` | active | cisco_supported |  |  |  | CiscoSecurityCloud (7404) |  | cisco:sna, cisco:sna:notable, cisco:sna:risk |
| `cisco_secure_workload` | active | cisco_supported |  |  |  | CiscoSecurityCloud (7404) |  | cisco:secure:workload |
| `cisco_talos` | active | splunk_supported |  |  |  | Splunk_TA_Talos_Intelligence (7557) |  | talos:domain, talos:ip, talos:url |
| `cisco_thousandeyes` | active | cisco_supported |  |  |  | ta_cisco_thousandeyes (7719) | cisco-catalyst-app (7539) | cisco:thousandeyes:account-group, cisco:thousandeyes:activity, cisco:thousandeyes:alerts, cisco:thousandeyes:event, cisco:thousandeyes:metric, cisco:thousandeyes:path-vis, cisco:thousandeyes:refresh-t ...(truncated) |
| `cisco_umbrella` | active | cisco_supported |  |  |  | TA-cisco-cloud-security-addon (7569) | cisco-cloud-security (5558) | cisco:cloud_security:audit, cisco:cloud_security:dlp, cisco:cloud_security:dns, cisco:cloud_security:firewall, cisco:cloud_security:proxy |
| `cisco_umbrella_investigate` | active | cisco_supported |  |  |  | TA-cisco-cloud-security-addon (7569) | cisco-cloud-security (5558) | cisco:cloud_security:investigated |
| `cisco_vulnerability_intelligence` | active | cisco_supported |  |  |  | CiscoSecurityCloud (7404) |  | cisco:cvi |
| `cisco_wlc` | active | cisco_supported |  |  |  | TA_cisco_catalyst (7538) | cisco-catalyst-app (7539) | cisco:ios, cisco:ios:traceback, cisco:telemetry |
| `cisco_wsa` | active | splunk_supported |  |  |  | Splunk_TA_cisco-wsa (1747) |  | cisco:wsa:l4tm, cisco:wsa:squid, cisco:wsa:squid:new, cisco:wsa:syslog, cisco:wsa:w3c, cisco:wsa:w3c:recommended |
| `cisco_xdr` | active | cisco_supported |  |  |  | CiscoSecurityCloud (7404) |  | cisco:xdr:incidents, cisco:xdr:incidents-summary, cisco:xdr:incidents-summary:notable |
| `cisco_8000_routers` | archived | not_supported | true | new_integration | 2 |  |  |  |
| `cisco_attack_surface_management` | roadmap | not_supported | true | new_integration | 4 |  |  |  |
| `cisco_collab_hardware` | roadmap | not_supported | true | new_integration | 1 |  |  |  |
| `cisco_crosswork` | roadmap | not_supported | true | new_integration | 2 |  |  |  |
| `cisco_eta` | archived | not_supported | true | new_integration | 4 |  |  |  |
| `cisco_eve` | archived | not_supported | true | new_integration | 4 |  |  |  |
| `cisco_hypershield` | roadmap | not_supported | true | new_integration | 3 |  |  |  |
| `cisco_industrial_networking` | roadmap | not_supported | true | new_integration | 5 |  |  |  |
| `cisco_iosxr_platforms` | roadmap | not_supported | true | new_integration | 2 |  |  |  |
| `cisco_mds_switches` | roadmap | not_supported | true | new_integration | 3 |  |  |  |
| `cisco_ncs` | archived | not_supported | true | new_integration | 2 |  |  |  |
| `cisco_netflow` | archived | not_supported | true | new_integration | 4 |  |  |  |
| `cisco_nexus_hyperfabric` | roadmap | not_supported | true | new_integration | 3 |  |  |  |
| `cisco_optics_cmis` | roadmap | not_supported | true | new_integration | 3 |  |  |  |
| `cisco_provider_connectivity_assurance` | deprecated | community_supported | true | rebuild | 2 | TA-skylight-for-splunk (5409) |  | skylight:alexa, skylight:citrix, skylight:cleanevent, skylight:dga_ml, skylight:dns, skylight:http, skylight:ml, skylight:smb, skylight:sql, skylight:tcp, skylight:ti, skylight:ti_domain, skylight:tls ...(truncated) |
| `cisco_psirt` | deprecated | not_supported | true | rebuild | 3 | ti-cisco-vuln (5183) |  | cisco:vuln:advisories, cisco:vuln:advisories:cvrf:note, cisco:vuln:advisories:cvrf:product, cisco:vuln:advisories:cvrf:summary, cisco:vuln:advisories:cvrf:vuln |
| `cisco_pxgrid` | archived | not_supported | true | new_integration | 1 |  |  |  |
| `cisco_secure_ai_factory` | archived | not_supported | true | new_integration | 3 |  |  |  |
| `cisco_secure_equipment_access` | roadmap | not_supported | true | new_integration | 5 |  |  |  |
| `cisco_security_cloud_control` | roadmap | not_supported | true | new_integration | 4 |  |  |  |
| `cisco_sonic` | roadmap | not_supported | true | new_integration | 2 |  |  |  |
| `cisco_telemetry_broker` | roadmap | not_supported | true | new_integration | 4 |  |  |  |
| `cisco_ucce` | roadmap | not_supported | true | new_integration | 1 |  |  |  |
| `cisco_webex_contact_center` | roadmap | not_supported | true | new_integration | 1 |  |  |  |
| `cisco_radware` | under_development | not_supported |  |  |  |  |  |  |
| `cisco_secure_client` | roadmap | not_supported |  |  |  |  |  |  |
