# Splunk for Secure Networking — Scoping Notes

Living doc for **Splunk for Secure Networking** (a.k.a. "the Secure Networking App" in the exec thread) — the Cisco Secure Networking app effort tied to **GSX (August 24–27, 2026)** and a **September 9 sales-play launch**, using `splunk-cisco-dashboards` as the proof-of-concept and demo base. Updated as we go — treat this as the source of truth over any single conversation.

## Source docs

- `~/Downloads/Splunk and SN Personas and Pillars.pptx` — 5 pillars, leader/operator personas per pillar, reference architecture (slide 14).
- `~/Downloads/SN Splunk Use Case mapping.xlsx` — 5 sheets: `Secure Networking Pillars` (~110 rows, leader+operator use cases), `Pillar Deep Dive` (Phase 1/2 tech per pillar, with real Splunkbase hyperlinks), `Pillar Mapping-ish`, `Chris Updates` (KPI-to-tech mapping), `Original` (earlier draft). Contains threaded comments from **Stephen Orr** and **Steven Moore** not visible in flat exports — see Reviewer Notes below.
- "Secure Networking App Build" daily standup (Webex, 2026-07-20, host Marta Connell) — see Stakeholders below. **Open question:** is this standup's "TA analysis and requirements spreadsheet from Dan's team" the same document as the xlsx above, or a separate one? Unconfirmed as of 2026-07-20.
- Exec/leadership thread (Alan Ivarson, Marta Connell, Dan Hosaka, Chris Crocco, Hari Won) — org decisions, timeline, and risk framing. See Timeline, Org & Ownership, and Risks sections below.
- **`GSX Accelerator — Secure Networking App and TA remediation.pdf`** (same folder as this doc) — the formal Workstream 1/2/3 plan: exec alignment on first-party sourcetype ownership, the Secure Networking App's 5-tab structure, and a TA-by-TA overhaul list with named owners/contacts and blocking status. See "TA remediation findings" below.
- **`Novo Nordisk - Customer Video - GSX.pdf`** (same folder) — the "BR12" customer-story script. Confirms Catalyst Center/SD-Access/SD-WAN (Secure Infrastructure/Segmentation) and Cisco Secure Access (ZTA) as the two areas this flagship customer narrative leads with — a signal for demo-content priority.

## Confirmed: this app IS the Secure Networking App

`splunk-cisco-dashboards` ("Splunk App for Secure Networking") is not a proof-of-concept for a separate app to be built — **it is the Secure Networking App** referenced throughout the exec thread and the TA-remediation PDF's Workstream 2. Confirmed directly by Amir 2026-07-20. The PDF's 5-tab structure (Network Segmentation / Zero Trust Access / Hybrid Mesh Firewalling / Secure Infrastructure / Agentic Ops) matches Chris's pillar taxonomy exactly, and is the taxonomy to build toward — not SCAN's GTM taxonomy.

## GSX demo requirement: must run inside C3 — but this is a later-phase workstream, not a GSX blocker

At GSX, the demo eventually needs to run **from inside Cisco Cloud Control (C3)'s own UI**, not standalone in Splunk Web. Checked 2026-07-20: this app has **no embedding infrastructure today** — no `web.conf`/`authentication.conf` (no SSO), and the only export mechanism (`useExportPage.ts`) is client-side PDF/PNG rasterization, not a live embeddable view.

**Corrected 2026-07-20, direct from Amir:** the direction is to *develop an app inside C3 that connects to Splunk* (not the reverse — we are not building something to monitor C3 from Splunk's side), and **this is explicitly "for later,"** not a GSX requirement. "We have nothing for C3 yet" and it doesn't make sense to build C3-monitoring now. Treat this as a deferred, Phase 2/post-GSX workstream — don't let it block GSX build priorities.

**Also corrected 2026-07-20:** `cisco-control-center-app` (found installed on `/opt/10`, "Cisco Control Center," codename "The Front Door") is **not related to C3** — it's an earlier name for `~/repo/splunk-cisco-app-navigator` (SCAN) before Amir renamed it. Not a duplicate app from another team; just this project's own naming history. No action needed there beyond what SCAN already provides (sourcetype/TA intelligence).

## Phase 1 (GSX) vs. Phase 2 (post-GSX)

**Confirmed by Amir 2026-07-20: Phase 1 items from the xlsx are needed for GSX; Phase 2 is post-GSX.** This is now the primary prioritization filter for all build work — see `SN_SEARCH_BUILD_LIST.md`'s "GSX Priority" section for the full phase-tagged breakdown (30 items are Phase 1 AND still need building — the real GSX punch list, out of 54 total buildable items).

## TA remediation findings (from the GSX Accelerator PDF, 2026-07-20)

This is the concrete output of the "TA ownership/funding" risk already flagged below — with specifics:

- **Active, blocking data-quality conflicts exist today**, not hypothetically: `TA_cisco_catalyst` has 54 duplicate ISE stanzas causing "silent field conflicts" against a *different*, Splunk-TA-Factory-owned `Splunk_TA_cisco-ise` (the intended canonical ISE source — not `TA_cisco_catalyst`, which the plan is to deprecate for ISE specifically). `TA-cisco-cloud-security-addon` has a 15% stanza divergence needing a merge. `CiscoSecurityCloud` vs. `Splunk_TA_cisco-asa` have unresolved ASA-sourcetype overlap. An "audit all Secure Infra TAs for overlap" item is explicitly blocking and unscoped.
- **Several canonical TAs named in the plan are not in our local inventory at all**: `Splunk_TA_cisco-ise`, `Splunk_TA_cisco-asa`, `cisco_sna_app` (standalone SNA, separate from `CiscoSecurityCloud`'s bundled SNA sourcetypes), `Splunk-TA-cisco-catalyst-center` (possibly `~/Downloads/catalyst-center-add-on_101.tgz`, unconfirmed), `Splunk_AI_Assistant_Cloud`. None found in `~/repo` or `/opt/splunk/etc/cisco-supported-apps`.
- **Direct corrections to `SN_SEARCH_BUILD_LIST.md`**: Intersight already has PSIRT/LDOS readiness data built in (item 32, less new work than estimated); `cisco_dc_networking_app_for_splunk` is described as already having VRF/VNI/GPO data (item 49/50 — re-verify directly, this doc only shows fabric-health sourcetypes so far); ThousandEyes explicitly includes NWPI (item 88 — but see the Phase tension noted in `SN_SEARCH_BUILD_LIST.md`).
- **Unresolved contradiction, not accepted either way**: the PDF says `CiscoSecurityCloud` carries "workflow analytics, agentic policy events" (items 81/82). Direct inspection of `SBG-splunk-security-suite`'s 19 `services` inputs earlier found nothing workflow-related. Needs a direct recheck before either the PDF's claim or the long-standing "Blocked, contact Reid Butler" classification is trusted.
- **Workstream 2's owner is listed "To be identified"** for the app itself and all 5 tabs in the PDF's appendix — this appears to predate or run parallel to the exec thread's later "Alan's team owns building" resolution; not necessarily a contradiction, but worth reconciling if it comes up.

## Timeline

- **GSX — August 24–27, 2026** (date confirmed by Amir 2026-07-21). This is the target event; Phase 1 = what's demoable at GSX, Phase 2 = post-GSX.
- **September 9 (9/9)** — tentative sales-play/enablement launch date (per Hari Won), ~2 weeks after GSX. **Before Splunk's `.conf`** (per Hari).
- Explicit descope risk: Dan Hosaka, on hearing the 9/9 date — *"yikes. ok. can we confirm that? If the date is pulled in we probably just need to find ways to descope."* Treat the gap-analysis/build prioritization as deadline-constrained, not open-ended.
- Chris Crocco has already directed the **dCloud team** to build demos with the apps/TAs as they exist *today* (not waiting on new builds) so there's something usable at GSX regardless of how the rest of this resolves.

## Org & Ownership (decided 2026-07-20, per Marta's recap)

- **Alan Ivarson's team** — owns *building* the Secure Networking App.
- **Chris Crocco** — owns the storyline, based on the 5 pillars + reference architecture (Hari supporting with sales-play content).
- **Dan Hosaka** — stays on as support for triage/product/publishing.
- **Tanya (Faddoul)** — advocating to P&T for long-term resourcing/ownership; needs a clear resource ask from the team to make that case (Alan may help scope it).
- **Hari Won** — owns sales-play content and GSX/9-9 timing; coordinating the daily-standup group and cross-sharing with a separate "SN group."
- Amir (AK, the user) — **the proof-of-concept**: per the thread, "get AK to demo what we have now to see how close we might be to the vision" is what triggered this whole effort; Marta/Tanya explicitly cited "really looking forward to what he can build after seeing the existing base he built." Also tasked (with Dan and Alan) to define how the app surfaces/integrates into Cloud Control, including docs + phased rollout plan.
- **Customer stories in progress**: Novo Nordisk (BR12), one more TBD (BR11).

## Stakeholders

- **Chris (Crocco)** — shared the pptx/xlsx; shared with Ray/Elliot; set the MVP scoping rule below; owns storyline (see Org & Ownership).
- **Ray, Elliot** — tasked by Chris with the demo content build (per original framing).
- **Marta Connell** — hosts the "Secure Networking App Build" daily standup; PM-style coordination role across both threads.
- **Tanya (Faddoul)** — product/business owner; advocating for P&T resourcing; asked AK for a 3-5 min Vidcast for leadership. Her earlier "must ship on Cloud Control marketplace" requirement is now understood as a **later phase**, not the initial launch target — see Distribution plan under Risks.
- **Moises** — contact for Cisco Cloud Control access/requirements (AK currently has limited/pending access).
- **Alan Ivarson** — owns building the app; flagged the TA-funding and app-ownership/distribution risks (see Risks).
- **Dan Hosaka** — triage/product/publishing support; in the "Splunk owns Cisco sourcetypes/TAs" camp on the ownership debate (see Risks).
- **Hari Won** — sales-play content + GSX/launch timing owner.
- **Stephen Orr, Steven Moore** — reviewers on the xlsx (threaded comments).
- **Reid Butler** — contact for Workflows API stats (Agentic Ops pillar).
- **Michal** — on the opposing side of the TA-ownership debate from Dan/Chris (see Risks).
- **Dan's team** — source of a "TA analysis and requirements spreadsheet" AK is reviewing; relationship to Chris's xlsx unconfirmed (see Source docs above).

## Risks (raised 2026-07-20, unresolved)

- **Pillar-taxonomy mismatch, found 2026-07-20.** AK's own SCAN product catalog (`~/repo/splunk-cisco-app-navigator`) encodes Cisco's *official* Secure Networking GTM pillars — 1 Secure Campus & Branch, 2 Secure WAN Edge, 3 Data Center & Cloud, 4 End-to-End Visibility & Assurance, 5 Industrial/OT — which is a **different framework** than the 5 pillars in Chris's deck (ZTA / Secure Infrastructure / Segmentation / Hybrid Mesh Firewalling / Agentic Ops) that this whole analysis has been organized around. Both are legitimately "Secure Networking, 5 pillars." Worth resolving directly with Alan and Chris before more work is scoped against either one — right now two people building toward "the 5 pillars" could mean two different things.
- **TA ownership/funding.** Alan Ivarson: the app's entire value depends on high-quality data from well-built, well-supported, *properly funded* TAs — but many Cisco TAs aren't clearly owned or funded by a Cisco product team today. This is a real threat to every "buildable gap" / "confirmed available" claim in `SN_GAP_ANALYSIS.md` and the app/TA inventory above — those TAs being *present* in a repo doesn't mean they're *funded to stay maintained*.
- **Two-camp ownership debate, unresolved**: (1) Cisco BUs own the Cisco sourcetypes/TAs, vs. (2) Splunk owns them. Chris and Dan are in camp 2; Michal is in camp 1. See Dan's doc `Cisco-Built Apps on SplunkBase.docx` for the full argument.
- **Distribution/support model.** Splunkbase policy blocks publishing an app there while claiming official Splunk association/endorsement/support unless done through a proper channel. Agreed interim plan (Alan): a **"middle tier, developer-supported" release** — same support level Splunk gives partners today — as a credible stepping stone, with a *later* path to Splunk-Supported or Cisco-Supported once P&T/FIE resourcing lands. **Phased rollout: Splunk-based launch first, Cloud Control/marketplace is a later phase** — this corrects the earlier framing in this doc that Cloud Control marketplace was the immediate target.

## The 5 pillars

1. **Zero Trust Access (ZTA)**
2. **Secure Infrastructure**
3. **Scalable Network Segmentation**
4. **Hybrid Mesh Firewalling**
5. **Agentic Ops**

Each has Leadership personas (CISO/CIO/CTO/VP-level) and Operator personas (network/security engineers, SOC analysts).

## Chris's MVP rule

If a requested visualization can't be immediately built from what's already available in the Enterprise Networking app + SSE/Security Cloud apps (or searchbase), skip it for MVP — don't build new data plumbing for this event.

## App / TA inventory (local repo paths)

| Splunkbase ID | Product | Local path | Role |
|---|---|---|---|
| 7539 | Cisco Enterprise Networking for Splunk Platform | `~/repo/app_cisco_common` | App — dashboards on `Cisco_Catalyst_App` datamodel (78 datasets incl. IP-SGT bindings, SGACL events, ISE authn/authz/TACACS policy hit) |
| — | Cisco Catalyst Add-on (`TA_cisco_catalyst`) | `~/repo/ta_cisco_common` | TA — Catalyst Center/DNAC, CyberVision, SD-WAN (vManage), ISE Administrative (SGT/Authz/TACACS/IP-SGT bindings), IOS syslog/NetFlow. AK hardened ISE telemetry here (PR #233, Jul 2026). |
| — | Cisco Meraki Add-on | `~/repo/Splunk_TA_cisco_meraki` | TA — security appliances (MX FW + VPN), org security, switches/ports, wireless, licenses, firmware, assurance alerts, cameras |
| 8485 | Spaces Add-On for Splunk (Cisco's own alpha) | n/a (Splunkbase only) | The TA Steven Moore's comment calls "partner built" — AK is reviewing it |
| — | Cisco Spaces Add-on (hardened replacement) | `~/repo/ta_cisco_spaces` | TA AK helped build — location/presence telemetry (WiFi/BLE presence, zone/floor/building, camera counts, IoT). **No SSID/auth-method fields** — that still needs Meraki. |
| 7777 | Cisco DC Networking App for Splunk | `/opt/splunk/etc/cisco-supported-apps/cisco_dc_networking_app_for_splunk` | Nexus/ACI/NDO/N9K — anomalies, advisories, orchestrator, flow/congestion/protocol, CIM-mapped |
| 7404 | Cisco Security Cloud (`CiscoSecurityCloud`) | `~/repo/SBG-splunk-security-suite` (use **develop** branch) | Unified app/TA: Duo, Secure Malware Analytics, XDR, Secure Firewall (syslog/ASA/eStreamer/API), Multicloud Defense, ETD, SNA, Secure Endpoint, CVI, AI Defense, Isovalent (+Edge Processor), Secure Client NVM, Secure Workload. v3.6.7, actively developed. Confirms provenance of XDR/AI-Defense/Duo/Isovalent sourcetypes already in `splunk-cisco-dashboards` searchbase. |
| 7569 | Cisco Secure Access Add-on for Splunk (TA) | `/opt/splunk/etc/cisco-supported-apps/TA-cisco-cloud-security-addon` | Data collection half of the Secure Access/SSE pair |
| 5558 | Cisco Secure Access App for Splunk | `/opt/splunk/etc/cisco-supported-apps/cisco-cloud-security` | Visualization half — CASB/Cloudlock incidents, Investigate API, block-destination actions |
| 7719 | Cisco ThousandEyes App for Splunk | `/opt/splunk/etc/cisco-supported-apps/ta_cisco_thousandeyes` | Cloud/Enterprise/Endpoint Agent tests, event/activity logs, network trace data |
| 7828 | Cisco Intersight Add-On for Splunk | `~/Downloads/Splunk_TA_Cisco_Intersight` | UCS/compute audit logs, inventory, alarms, perf metrics, HCL compliance, AI-server/GPU visibility (v3.2.0) |

`~/repo/splunk-cisco-dashboards` (this repo, app label **"Splunk App for Secure Networking"**, confirmed via `app.conf`) — dispatches searches into `cisco-catalyst-app` context. **This is the exact app Amir demoed on the 2026-07-20 standup** (React dashboard, IT health/security/building-intelligence sections, site map, signal rail).

**Architecture, corrected 2026-07-20:** `searchbase.conf` (814 stanzas) is not just a demo config — it's the live authoritative source driving this app's actual landing dashboard. `data/ui/views/workspace_insights.xml` ("Executive Briefing Workspace") is a thin shell (`hideEdit`/`hideExport`/`hideTitle`, single `div#scan-root`) bootstrapped by `executive_insights_bootstrap.js`; the real tile-building logic lives in `src/main/webapp/pages/executive_insights/index.tsx`, which reads `searchbase.conf` stanzas' `viz_options` JSON metadata at runtime to build the overview tiles and map footer (per `CLAUDE_CODE_HANDOFF.md`). It does not define what raw data/TAs exist (that's the app/TA inventory above) — it defines how this app's own dashboards are configured.

**`~/repo/searchbase`** — confirmed 2026-07-20: this is the "Search Base" app Amir described on the standup. General-purpose Splunk product (not Cisco-specific, part of an "Insights Suite for Splunk"), org `sg-cloud-tools-engineering`. It's a **cross-app aggregator** — its React UI (category/sub-category/tag browser, drag-and-drop custom dashboard building without SPL) is designed to surface `searchbase.conf` stanzas from *any* installed app on a search head, not just one. In practice today, `splunk-cisco-dashboards` is the **only** app in the entire local inventory with its own `searchbase.conf` (checked `app_cisco_common`, `ta_cisco_common`, Meraki/Spaces TAs, `SBG-splunk-security-suite`, and all of `/opt/splunk/etc/cisco-supported-apps` — none have one). Confirmed via screenshot: 576 of the 814 stanzas are indexed and browsable today, filtered to Application = "Splunk App for Secure Networking". This means the planned ~100-150 new SN-pillar searches would naturally land in this repo's `searchbase.conf`, since it's the sole catalog on the search head.

**Existing searchbase.conf category taxonomy** (814 stanzas, all categories) — this is the baseline Amir's planned gap analysis (existing searches vs. 5 SN pillars, ~100-150 new searches estimated) needs to work from. None of these map 1:1 onto the 5 pillars:

| Category | Count |
|---|---|
| Network | 202 |
| Security | 186 |
| Monitoring | 127 |
| Cisco Spaces | 72 |
| Network Operations | 54 |
| Building | 50 |
| IT Health | 39 |
| Identity | 35 |
| NetOps Readiness | 26 |
| Workplace | 8 |
| ThousandEyes | 7 |
| Asset | 5 |
| Admin | 3 |

**`~/repo/splunk-cisco-app-navigator`** — confirmed 2026-07-20, NOT just a unifying shell as previously guessed: this is **SCAN** (Splunk Cisco App Navigator), AK's own master product catalog. `packages/splunk-cisco-app-navigator/src/main/resources/splunk/default/products.conf` has 93 Cisco-product stanzas, each with `status` (active/deprecated/retired/under_development/roadmap/archived), `support_level` (cisco_supported/splunk_supported/developer_supported/community_supported/not_supported), the exact `addon`/`addon_uid`/`app_viz`/`app_viz_uid` pairing, and a full `sourcetypes` list — plus `coverage_gap`/`gap_type` flags for roadmap products with zero Splunk integration (35 of the 93). This is now the authoritative cross-check for "is this data really available and reliably supported," ahead of grepping individual repos. Full extract of the 68 Secure-Networking-flagged products: **`SN_SOURCETYPE_REFERENCE.md`** (same folder). See `SN_GAP_ANALYSIS.md`'s SCAN cross-reference section for what changed in the gap analysis as a result.

Not yet reviewed / lower priority: `ciscoSplunkC2CReporting` (Comply-to-Connect — may cover PQC/Broccoli hardening status), `cisco-catalyst-enhanced-netflow`. Treat `ta_cisco_common_pr213` and `cisco_enterprise_networking_app` (legacy POC) as noise.

## Live environment: `/opt/10` and `/opt/splunk/etc` (confirmed 2026-07-20)

**`/opt/10`** is a live, running Splunk 10.4.1 instance (`sh-i-10`) with real demo data — credentials `codex`/`changeme`, management port **8093** (not the default 8089). This is now the fastest way to validate any search before writing it into `searchbase.conf` — query via `https://localhost:8093/services/search/jobs/export`. Its installed-apps list (`/services/apps/local`) turned out to be the actual complete answer to several TAs the GSX remediation PDF named that weren't in `~/repo`: `Splunk_TA_cisco-ise`, `Splunk_TA_cisco-asa`, `Splunk-TA-cisco-catalyst-center`, `Splunk_AI_Assistant_Cloud`, `cisco-sdwan-app`, `Splunk_TA_cisco-ucs`, and `field-solutions-demo-data-gen` are all installed and live there. `cisco_sna_app` is *not* installed on this instance (though it exists in the filesystem inventory below) — worth a follow-up if SNA-specific content is needed.

**`/opt/splunk/etc`** has the complete Cisco app/TA inventory pre-organized by support tier: `cisco-supported-apps`, `splunk-supported-apps`, `developer-apps`, `not_supported-apps`, `archived-apps`. The `archived-apps` folder alone is a graveyard confirming the TA-fragmentation risk with hard evidence — multiple superseded apps for the same products (e.g. `Splunk_CiscoISE`/`Splunk_CiscoDNACenter` predating today's canonical TAs, `TA-intersight-addon` predating `Splunk_TA_Cisco_Intersight`, `ti-cisco-vuln` — the deprecated PSIRT feed already flagged via SCAN, `TA-skylight-for-splunk` — matches SCAN's `cisco_provider_connectivity_assurance`). Use this tree to harvest real, tested SPL from existing dashboards before writing new searches from scratch — confirmed working for `Splunk_TA_cisco_meraki` and `Splunk_TA_cisco-ise` dashboards already.

**Demo-data status, distinct from capability gaps:** checked 2026-07-21 — demo-data-gen now has real sample files for `cisco:cloud_security:dlp`, `cisco:cloud_security:ravpn`, `cisco:intersight:advisories`, and `cisco:ise:sgtbindings`, and `searchbase.conf` now has live-export-validated stanzas built from those schemas. Still missing or not yet validated with useful samples: `cisco:ise:securitygroups`, `cisco:sdwan:sgacl:logs`, and DC ACL-log style `cisco:dc:aci:class` events. The new sample-backed searches are syntax/runtime clean in `/opt/10`, but the current search window returns no rows for those newly seeded sourcetypes, so result-shape validation still needs the samples indexed.

## Insights workspace engine — Secure Networking (2026-07-20)

The shared Insights engine has config-backed workspace support — confirmed by reading `common/config/insightsWorkspaces.ts`, `pages/executive_insights/index.tsx`, and `common/services/insightsWorkspaceService.ts`. The `secure_networking` workspace is the default and has 5 sections (`zta`/`secure_infrastructure`/`scalable_network_segmentation`/`hybrid_mesh_firewalling`/`agentic_ops`), plus auto-discovery keyed on stanza prefix `secure_networking_`, tag `Secure Networking`, and the matching `subCategoryToSection` mapping. Auto-discovery only kicks in when a record has **zero** explicit `workspace: "secure_networking"` entries in its `viz_options.overview` array — explicit entries give real control (valueField, thresholds, color) that auto-discovery does not.

**21 stanzas now carry an explicit `secure_networking`-scoped `viz_options.overview` entry** (all validated for JSON correctness and globally-unique `tileId`s; count re-verified 2026-07-21 by parsing the conf): ZTA (5), Secure Infrastructure (3), Segmentation (4), Hybrid Mesh Firewalling (6), Agentic Ops (3). Existing executive-source searches can appear in **both** source workspaces via multiple array entries — no duplication, same search reused.

`insights_workspaces.conf` carries 5 `[layout.secure_networking.<section>]` stanzas listing tile IDs in display order plus `visible_count` per section.

**Segmentation and Secure Infrastructure are thin (2 tiles each)** — every other pillar has 3-5. This directly reflects real coverage, not an oversight: Segmentation has almost nothing pre-existing to draw on (matches the earlier finding that it's the highest-effort pillar), and Secure Infrastructure's existing stanzas mostly lack a single obvious scalar headline field.

## Tagging convention (confirmed 2026-07-20)

New `searchbase.conf` stanzas for this project get: stanza ID prefix `secure_networking_`, and `tags` including **`Secure Networking`** plus the specific pillar name (e.g. `Zero Trust Access`, `Hybrid Mesh Firewalling`), alongside the existing `SCD` + product tags convention. This makes them findable via the Searchbase app's Tags filter without touching the existing category taxonomy. First 3 built 2026-07-20: `secure_networking_ise_policy_family_overview`, `secure_networking_meraki_threat_blocks_by_category`, `secure_networking_catalyst_center_software_version_inventory` — see `SN_SEARCH_BUILD_LIST.md` for what they satisfy.

## Gap analysis (2026-07-20)

Full row-by-row gap analysis of the xlsx `Secure Networking Pillars` sheet against the 814-stanza `searchbase.conf` and the app/TA inventory below is done: **`SN_GAP_ANALYSIS.md`** (same folder). Analysis only — no new stanzas written yet. Summary: 23 covered (incl. partial), 30 buildable gaps, 6 blocked gaps, 8 needs-follow-up, across all 5 pillars. Segmentation has the most buildable gaps (12 — SGT/TrustSec data exists in `app_cisco_common`/`ta_cisco_common` but nothing in this app's searchbase queries it yet); Agentic Ops has the most needs-follow-up (several xlsx rows are the authors' own speculative placeholders).

**Superseded/extended 2026-07-20 by `SN_SEARCH_BUILD_LIST.md`** — the same analysis, but run against **all four** xlsx tabs (`Secure Networking Pillars`, `Pillar Deep Dive`, `Pillar Mapping-ish`, `Chris Updates`), decomposed into 98 distinct candidate searches and cross-checked against SCAN's `products.conf` for precise sourcetypes/TA/support_level. Roll-up: 14 available, 48 needs-work, 6 needs-new-TA, 17 blocked, 13 needs-follow-up. Segmentation is by far the highest-effort pillar (21 of 24 items need work, zero available). This is the current authoritative "what to build" list — treat `SN_GAP_ANALYSIS.md` as superseded for anything `SN_SEARCH_BUILD_LIST.md` also covers.

## Confirmed gaps (checked across the full inventory above, not guesses)

- **Security Cloud Control (SCC) telemetry** — grepped `TA-cisco-cloud-security-addon`, `cisco-cloud-security`, and `SBG-splunk-security-suite` (develop) for "Security Cloud Control"/"SCC": zero hits anywhere. Kills literal "devices attached to SCC" / SCC sync-status asks as stated, though underlying FW/access data is otherwise covered.
- **Workflows API / Agentic Ops usage stats** (most/least used, reverted workflows) — no TA anywhere. Steven Moore: *"contact Reid Butler - we can pull stats via Workflows API."*
- **PQC / Project-Broccoli hardened-code-level compliance** for network devices (IOS/NX-OS) — Intersight covers HCL/compliance for UCS/compute, not network device crypto-readiness. Steven Moore confirms this is a real current-state gap.
- **VRF/VLAN parsing beyond ISE** — Steven Moore (B4): not sure how to pull this into Splunk short of parsing device config.
- **"Site score for SN"** composite readiness metric — no known collection mechanism (Steven Moore, B12).

## Reviewer notes worth acting on (from threaded comments, not visible in flat exports)

- **Steven Moore, B29**: Amir (AK) is already tasked with reviewing the partner-built Spaces TA (app 8485) — independent of this event, but directly relevant.
- **Steven Moore, B25**: Workflows API stats — contact **Reid Butler**.
- **Steven Moore, B16**: SGACL counters are pullable directly from the box (confirmed — matches `Cisco_Catalyst_SGACL_Events` in `app_cisco_common`).
- **Steven Moore, C12**: Secure Infra readiness needs router/switch IOS version vs. target release — *"Orr has those"* (target/golden release list).
- **Stephen Orr**: wants Secure Infrastructure scope widened to MACSec/IPSec/TLS with cipher-suite + PQC-vs-classic negotiation detail, and device coverage extended to UCS/iPhones/RoomOS/WLC/MCG/IIoT gear.
- Yellow-highlighted rows in "Secure Networking Pillars" sheet: all the DC/Cloud Hybrid Mesh Firewalling operator rows (policy hits N/S·E/W, DC FW Front Door, Hybrid Mesh FW Logs, ToR FW/DPU, Cloud Alerts, App Security Data) — flagged for unknown reason, worth asking Chris/Steven directly.

## Open questions

1. Is `field-solutions-demo-data-gen` a synthetic data generator that could stand in for live TAs at the event?
2. Does `ciscoSplunkC2CReporting` actually close the PQC/Broccoli hardening-status gap?
3. What's the intent behind the yellow-highlighted DC/Cloud Hybrid Mesh Firewalling rows?
4. Two different Secure Access links appear in the xlsx (bare 5558, labeled 7569) — same app family, but worth confirming with Chris/Ray/Elliot which is current for this event.
5. Is the standup's "TA analysis and requirements spreadsheet from Dan's team" the same as Chris's `SN Splunk Use Case mapping.xlsx`, or a separate document?
6. ~~Standup flagged "missing data related to Catalyst Center visibility" as a gap~~ — **resolved by the gap analysis**: Catalyst Center/DNAC data is extensively present and queried already throughout searchbase.conf. Not a raw-data gap. If Amir's standup comment referred to something specific, it's more likely one of the buildable gaps in `SN_GAP_ANALYSIS.md` that happens to route through Catalyst Center (e.g. LDOS/EoL tracking, SGT-to-fabric mapping) — still worth a direct follow-up with Chris to pin down exactly which visualization was meant, but the "no Catalyst Center data at all" framing is not accurate.
7. ~~Is "Splunk for Secure Networking" the whole Cisco Cloud Control marketplace product effort, with the event a milestone inside it?~~ — **resolved 2026-07-20**: it's one initiative. GSX/9-9 is the near-term launch (Splunk-based, developer-supported tier); Cloud Control/marketplace is an explicitly later phase per Marta's recap.
8. ~~What's the actual GSX date?~~ — **resolved 2026-07-21: GSX is August 24–27, 2026** (confirmed by Amir). 9/9 sales-play launch is ~2 weeks after.
9. What resourcing ask should go to Tanya for P&T advocacy? Alan was asked to help scope this — status unknown.

## Standup action items (2026-07-20, "Secure Networking App Build")

- [ ] AK to work directly with Moises on Cloud Control access/requirements, keeping Tanya looped in.
- [ ] Marta to confirm Chris's availability for next meeting + get his input on the Catalyst Center visibility question.
- [x] AK to perform gap analysis: existing searchbase.conf categories (see table above) vs. 5-pillar requirements → done, see `SN_GAP_ANALYSIS.md` (2026-07-20). 30 buildable gaps found vs. the ~100-150 new-search estimate — needs reconciling (each gap likely decomposes into several searches).
- [ ] AK to produce a 3-5 min Vidcast introducing the dashboard + searchbase repository for Tanya to share with leadership.

## Decision log

- **2026-07-20** — Corrected `searchbase.conf` stanza count from 840 to 814 (the "840" figure counted SPL subsearch brackets like `[ search ... ]` as false stanza headers). All references to "840" elsewhere in this doc's history should be read as 814.
- **2026-07-20** — Full gap analysis produced (`SN_GAP_ANALYSIS.md`), scoped as analysis-only per explicit user direction ("we are not adding searches now, i need to know what are we missing now"). Sequencing decision: full 5-pillar gap analysis first, rather than one pillar at a time — chosen so total scope is visible before any authoring starts.
- **2026-07-20** — Org/ownership decided by leadership (Alan's team builds, Chris owns storyline, Dan stays on support, Tanya advocates for P&T resourcing, Hari owns launch timing). Distribution plan corrected: Splunk-based launch first (developer-supported tier), Cloud Control/marketplace is a later phase, not the initial target. Target launch 9/9, tied to GSX, with explicit descope risk if the date moves.
