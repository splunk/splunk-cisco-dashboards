# net_apps.tgz Harvest Report — 2026-08-04

Read-only research task: reviewed all 5 dashboard-bearing demo apps in `~/Downloads/net_apps.tgz` for Cisco Splunk search patterns worth harvesting into `searchbase.conf` (1120 stanzas at the start of this review). Fake/demo-flavored sample data was explicitly **not** treated as disqualifying — panels were judged on SPL/operational logic, not on how realistic the numbers looked.

Apps reviewed: **netmoncampus** (Catalyst Center/DNAC), **network_monitor/maple_lab** (Core/MPLS), **network_monitor/tiago** (general NetOps), **network_monitor-meraki_assurance** (Meraki NOC), **network_monitor_acme** (Acme Labs multi-domain). Two apps (`network_monitor_meraki`, `network_monitor_srv6_mpls`) had no dashboard content and were excluded. `network-diagram-viz` is a generic visualization framework with no Cisco-specific searches and was deprioritized.

## Headline numbers

| App | Panels | NEW-HIGH-VALUE | Low-value | Duplicate |
|---|---|---|---|---|
| netmoncampus (Catalyst Center) | 49 | 13 | 2 | 34 |
| maple_lab (Core/MPLS, IOS-XR telemetry) | 49 | 37 | 11 | 1 |
| tiago (NetOps, IOS-XR telemetry) | 49 | 43 | 3 | 3 |
| meraki assurance | 56 | 25 | 22 | 9 |
| Acme Labs (batch 1 of 2) | 29 | 16 | 7 | 6 |
| Acme Labs (batch 2 of 2) | 29 | 13 | 6 | 10 |
| Acme Labs untitled panels | 119 | — | — | 118 empty layout elements, 1 hardcoded single-device lookup (skipped, no template value) |
| **Raw total** | **380** | **147** | **51** | **63** |

**Critical dedup finding:** maple_lab and tiago are two different demo dashboards built on the **exact same underlying data source** — Cisco IOS-XR model-driven streaming telemetry via `mstats` against `index=cisco_metrics` (BGP/IS-IS/MPLS-TE/RIB/optical paths). About 32 of their combined 80 "new" panels are near-identical or byte-identical SPL (same field paths, same thresholds). After merging, this single telemetry domain yields **~42 unique reusable stanzas**, not 80. See "IOS-XR telemetry" section below — this is the number that should drive planning, not the raw per-app counts.

Net unique NEW-HIGH-VALUE across all apps after dedup: **~112** candidate panels.

---

## 1. Cisco IOS-XR streaming telemetry (maple_lab + tiago, deduplicated) — ~42 unique patterns

This is a **platform our catalog has zero coverage of today**: core/PE routers via model-driven telemetry (`Cisco-IOS-XR-*-oper` and `openconfig:*` paths into `index=cisco_metrics`), not DNAC/Catalyst Center and not IOS syslog parsing. Confirmed via grep: zero existing stanzas reference `cisco_metrics` or any `Cisco-IOS-XR-*` path.

- **Device health (12):** CPU/Memory utilization status+trend, per-interface Input/Output Utilization, Peak Interface Throughput (streamstats byte-delta → real bps, not a raw counter), Down Interface %, Input/Output Errors, Input/Output Drop Rate (Warning≥5%/Critical≥10%), Disk Utilization (router bootflash/harddisk — distinct entity from existing ISE-node/ACI-filesystem disk stanzas).
- **BGP (12, deduplicated from ~20 raw):** % Established Neighbors, Total BGP Paths, BGP Memory Use, Update Message Rate, BGP Restart Count, Number of Throttled Neighbors, Average Convergence Time, RIB connection drops, per-neighbor Session Uptime (openconfig), BGP Notification Rate, BGP Session State Trends (FSM decode: Idle→Established), BGP Connection Drops/Flap scoring (streamstats delta across 4 instability counters, sankey-visualized). Our catalog's only existing "BGP" content is ThousandEyes synthetic path monitoring — none of this internal BGP-process telemetry exists anywhere.
- **IS-IS (6, identical between both apps):** Adjacency Uptime %, SPF Run Rate (storm detector), Hello PDU Drop Rate, Route Count in RIB, LSP Refresh Status, Input Queue Drops. Zero dedicated IS-IS content exists today (only a generic `%ISIS-` syslog mnemonic bucket).
- **MPLS-TE/RSVP-TE tunnels (5, identical between both apps):** % Up P2P Head Tunnels, FRR Protection Coverage, Tunnel Convergence Time, Autobackup Tunnel Utilization, Rerouted Tunnels Rate. Zero MPLS-TE content exists today.
- **RIB/routing health (3, identical):** Route Churn Rate, Average Route Age (staleness detector), Path Diversity/PIC Count (fast-reroute redundancy KPI).
- **Optical transport (4, identical):** Average Pre-FEC BER, % Ports with High Uncorrected BER, Average Transmit Power, % Lanes with Low SNR. Entirely new domain — zero optical/transceiver content exists.
- **Anomaly-detection patterns (3, high architectural value):**
  - VRF Route Count Anomaly — time-of-day baseline z-score (`eventstats avg/stdev by time_of_day | z_score`); reusable statistical-baseline template, currently only used once elsewhere (Spaces occupancy surge) and never for routing data.
  - MLTK CPU Anomaly (tiago) — `apply cpu_anomaly_model_all_routers` DensityFunction integration.
  - MLTK Interface Error Anomaly **+ explanation table** (maple_lab) — the single most novel SPL in either dashboard: parses a DensityFunction model's `BoundaryRanges` output via `rex`/`mvmap` into human-readable root-cause text and an `operator_action` recommendation column. Worth harvesting as a generic "explainable anomaly" template regardless of domain, independent of the specific model.
- **Bonus (maple_lab, orphaned but real):** an unwired data source computing SRv6 L2/L3 SID counts and memory per BGP instance — zero SRv6 coverage exists anywhere in the catalog.

Both MLTK-dependent panels require a pre-trained model artifact we don't have — harvest the SPL pattern, flag the model dependency, don't expect it to run as-is without training data.

---

## 2. Cisco ACI/APIC fabric health (Acme Labs) — 29 candidates, zero existing coverage

Grep confirmed: **the catalog has no Bridge Domain, Fabric Health, L3Out, or Tenant-Fault stanzas at all.** Acme's ACI section fills a genuine, large gap:

- Fabric Health trend, Faults Over Time (by severity), Faults by Tenant (top-N), Bridge Domain Health (per-BD sparkline trend), Bridge Domain Inactive (expected-vs-reporting reconciliation — a reusable drift-detection pattern beyond ACI), L3Out health overview.
- A standout **composite ACI health score** — single weighted KPI fusing fabric/tenant/BD/EPG/L3Out/leaf/spine sub-scores with severity-weighted fault penalties.
- A standout **cross-domain "Overall Service Health"** composite — blends ThousandEyes availability, BGP prefix-health, interface up/down, firewall throughput+block score, VMware host-hot-streak health, and the ACI score above into one number. Worth harvesting even just for the scoring-skeleton architecture.

## 3. VMware/vSphere host performance (Acme Labs) — 6 candidates, new data source entirely

`vmware-perf`/`vmware:inv:hostsystem` raw ESXi counters — distinct from the catalog's existing ACI-side VMware integration (VLANs/alarms/errored packets only, no host performance). Storage Used, Host CPU/Memory Usage, CPU Scheduler Latency (co-scheduling contention — a real degradation leading-indicator), Host Power State, Network Packets/Drops per host, CPU Demand-vs-Usage gap (contention proxy), CPU Time Breakdown (wait-time is a known perf red flag), Datastore capacity-tiered classification.

## 4. Firewall/NAT (Acme Labs) — several candidates

NAT translation top-N (confirmed no `NAT_Initiator`/`NAT_Responder` fields exist anywhere else in the catalog), and a composite Firewall KPI using dynamic percentile-based throughput banding (`eventstats perc5/perc50/perc90`) blended with deny-rate banding — a self-normalizing scoring technique not duplicated by the catalog's existing simple blocked-count stanzas.

## 5. Cisco DNAC/Catalyst Center — deeper features (netmoncampus) — 13 candidates

Existing catalog coverage of Catalyst Center is decent (34 of 49 panels were duplicates) but missing: structured WIPS/rogue-AP feed (richer than syslog-inferred rogues — full threat table with RSSI/SSID/containment), DNAC-issue-based flapping/churn detector, client onboarding KPIs by site (with failing-client MAC list), RSSI/SNR quality-band distributions, SGT (TrustSec) and VNID (SD-Access) breakdowns, fabric-vs-non-fabric client visibility, PoE power consumption (zero PoE content anywhere in catalog today), VLAN client-count breakdown, per-AP client-load distribution, per-SSID quality scoring.

## 6. Meraki — deeper features (meraki assurance) — 25 candidates

Existing Meraki coverage (15 stanzas) is airmarshal/organizationsecurity/devices/top-clients only. Zero coverage of: assurance alerts, device availability history, switch ports, SD-WAN/VPN status, firmware upgrades, uplink addresses, appliance/switch-power/device-usage summaries. Highlights: full alerting pillar (active-alert worklist + trend + triage sparklines), a genuinely novel cross-source **Top Impacted Networks** impact score (`critical_alerts×10 + devices_down×5 + active_alerts`, joining alert severity against device-availability history), switch-port config/power/incident views, SD-WAN/VPN reachability + uplink public-IP flap detector (RCA signal), firmware-lifecycle tracking, richer rogue-AP intel (adds RSSI + wired-MAC honeypot evidence vs. existing SSID-only table), VPN-peer and AP-usage rankings.

---

## Notably NOT recommended (representative low-value / duplicate patterns)

- Bare single-dimension averages/counts with no threshold or context (disk throughput, packet counts, interface throughput without direction-aware framing) — real metric, no differentiation from a plain trend chart.
- Anything already covered by `apic-fabric-overview`/`apic-tenant-overview` macros (Spine/Leaf/EPG/Tenant health, fault listings) — Acme's ACI coverage overlaps here even though Bridge Domain/L3Out/composite-score do not.
- ThousandEyes latency/jitter/availability variants — heavily covered already across all apps that touch it.
- Meraki's "Network Availability %" — computed from arbitrary hardcoded alert-count buckets rather than measured uptime; methodologically weak, not worth harvesting as-is.
- Acme's two Sankey diagrams reusing the VRF z-score base search — the source→target "flow" is arbitrary array-index chaining, not a real topological relationship; the underlying anomaly table is worth harvesting, the Sankey framing is not.

---

## Next step

This is a report, not yet applied to `searchbase.conf`. If you want to proceed, the natural next phase is deciding scope (e.g., "harvest all NEW-HIGH-VALUE," or prioritize specific domains like ACI or IOS-XR telemetry first) and then converting the selected SPL into properly-tagged 13-field stanzas (category/sub_category/tags/drilldown/description per the SKILL.md contract) — that's a separate, larger writing task from this research pass.
