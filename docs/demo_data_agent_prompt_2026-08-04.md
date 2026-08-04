This is a ready-to-send prompt for the agent that maintains this environment's demo-data generator. Send everything below the line to that agent as-is. Background: `docs/searchbase_zero_data_diagnostic_2026-08-04.md` in this repo has the full evidence trail if it needs more context.

---

I need you to close specific, confirmed gaps in the demo data generated for the `/opt/10` Splunk instance backing the `splunk-cisco-dashboards` app. These gaps were found by running all 191 currently-zero-result Searchbase catalog searches directly against the live instance and inspecting real Splunk diagnostics (not guessed from search text) — every item below is confirmed, not speculative.

## 1. Sourcetypes with zero events, any time range (generate new event streams)

Add event generation for these 7 sourcetypes. They currently have **no events at all**:

| Sourcetype | Real product this represents | Notes |
|---|---|---|
| `cisco:dc:aci:syslog` | Cisco ACI APIC syslog stream | Sibling structured sourcetypes (`cisco:dc:aci:class`, `cisco:dc:aci:health`, `cisco:dc:aci:stats`) already exist with real data — use the same node/tenant/site identifiers those use so the syslog stream is internally consistent with the structured data. |
| `cisco:dc:nd:syslog` | Cisco Nexus Dashboard syslog stream | Same consistency requirement against existing `cisco:dc:nd:mso`/`cisco:dc:nd:advisories`/`cisco:dc:nd:anomalies` data. |
| `cisco:dc:mso:syslog` | Multi-Site Orchestrator syslog stream | Needs at minimum: configuration-change, accounting, ethernet, guestshell, missing-warning, module, system-message, and VDC-state-change event classes (these are the exact categories the catalog's syslog dashboards filter on). |
| `cisco:dc:nexus9k:syslog` | Nexus 9000 switch syslog stream | Needs BFD, configuration, ethernet, OSPF, PIM, and system event classes, plus a recognizable "mnemonic" field and a severity field (multiple dashboards break these down by mnemonic/severity/reporting host). |
| `cisco:cloud_security:ztna` | Cisco Secure Access / ZTNA session logs | Needs session-outcome events with a device-category field and a blocked/denied-reason field. |
| `ms:defender:atp:alerts` | Microsoft Defender for Endpoint alerts | Single stanza depends on this; low priority unless Defender is otherwise in scope. |
| `splunk:aa:forensic:mitreattacks` | Splunk Attack Analyzer MITRE ATT&CK forensic detail | Single stanza depends on this. |

## 2. Accelerated data model datasets with zero underlying events

`Cisco_DCN_nexus_dashboard.flows`, `.congestion`, `.endpoints`, and `.protocols` all resolve to **zero events** — this is the Nexus Dashboard flow-telemetry family (flow records, congestion metrics, endpoint anomaly scores, interface/protocol statistics) and it affects 21 catalog searches. Check which raw sourcetype(s) these dataset constraints expect (see the data model definition in `cisco_dc_networking_app_for_splunk`) and generate matching flow/congestion/endpoint/interface telemetry events.

## 3. Narrower gaps — the sourcetype has data, but a specific object/attribute/endpoint value is missing (14 searches)

These don't need a new sourcetype, just broader coverage within one that's already populated:

- **`cisco:dc:aci:class`**: already has real events with `component=fvAp` (5 total in this dataset's 223-event base) but none carry a `dn` field ending in `/health`. Also missing entirely: any event with `component=eqptExtCh` (exact, no suffix), `component=eqptSensor` with a `dn` matching `*extch*`, `component=fabricHealthTotal` with `dn="topology/health"`, `component=fvAEPg` with `isAttrBasedEPg=yes`, and `dn` values matching `uni/tn-*/ap-*/epg-*/crtrn/ipattr*` or `.../macattr*` (microsegmentation attribute-based EPGs).
- **`cisco:dc:nd:mso`**: has real data for `mso_api_endpoint=schemaDetails` and `tenantDetails`, but zero for `mso_api_endpoint=policyDetails` — add policy-detail records (including a `policySubtype` field, e.g. `relay`).
- **`cisco:ise:syslog`**: 157k+ real events exist, none reference RadSec/RADIUS-over-TLS (keyword `"RadSec"` or `"RADIUS over TLS"`, or `dest_port`/`destination_port`=2083). Add a slice of RadSec-specific auth events.
- **`cisco:dnac:client`**: 87k+ real events exist, but none have `type="Wireless"` with an `onboarding.totalRoamingAttempt` field — add wireless roaming-attempt telemetry.
- **`Cisco_Catalyst_App` data model, `Cisco_Catalyst_SGACL_Events` node**: 0 events, while the parent data model has 2.1M+ events overall from other nodes — add SGACL enforcement events under this specific node.

## 4. Lookup CSVs that ship empty (populate reference/dimension data — not event data)

These are static reference tables in `cisco_dc_networking_app_for_splunk/lookups/`, currently 0 rows each. 33 catalog searches join against them and lose every row because the join side is empty:

| Lookup file | What it should contain |
|---|---|
| `cisco_dc_APICNodeTable` | APIC node ID → site/pod/role mapping (used by 15 searches, mostly fabric/fault detail panels) |
| `cisco_dc_APICCEPLookup` | Client endpoint (CEP) ID → tenant/EPG mapping (8 searches, VMware/atomic-counter panels) |
| `cisco_dc_nexus_hostname_lookup` | Nexus device ID → hostname mapping (7 searches, interface/mnemonic panels) |
| `cisco_dc_nexus_inventory_lookup` | Nexus device ID → physical inventory (model, serial, slot) mapping (3 searches, physical inventory panels) |

Populate each with rows whose key identifiers (node IDs, CEP IDs, device IDs) actually match the identifiers already present in the corresponding real event data (`cisco:dc:aci:*`, `cisco:dc:nexus9k`), or the join will still silently drop rows even once the lookup has content.

## 5. Lower priority — likely self-resolving

Three `spaces_fit_*`/`teuc_fit_*` ML anomaly-detection searches (`DensityFunction`) already started producing real results as more days of history accumulated (data ingestion began ~2026-07-25/26; by 2026-08-04 there's enough). Three more (`spaces_fit_camera_multivariate_anomaly`, `spaces_fit_device_presence_ratio_anomaly`, `teuc_fit_multivariate_network_health_anomaly`) still report "too few training points in some groups" — no action needed unless you want to backdate more history to speed this up.

## Explicitly out of scope for you

39 other failing searches have real matching data already — their problem is a field-name mismatch in the search itself (e.g. one averages a field called `pktLen` that doesn't exist; the real field is `txPkt`/`rxPkt`), not missing data. 8 more reference a data model (`Secure_Firewall_Dataset`) that isn't defined anywhere in this environment — that's a data-model/app-dependency question, not a demo-data question. Full lists are in `docs/searchbase_zero_data_diagnostic_2026-08-04.md` (Tiers C and G) if you want to sanity-check that a fix on your end wouldn't also help those, but they're not your primary target.
