# Secure Networking — documentation index

Single entry point for the **Splunk Secure Networking Essentials** effort (Cisco GSX, **August 24–27, 2026**; sales-play launch ~Sept 9). Start here, then open the doc that matches what you need. No single file is the whole-session summary — the work is intentionally split by concern across the files below.

## The docs

| File | What it holds | Authoritative for |
|---|---|---|
| `SN_EVENT_SCOPING.md` | Stakeholders, timeline (GSX Aug 24–27), org/ownership, distribution plan, risks, the full app/TA inventory, C3 clarification, the Overview-engine (`viz_options.overview` + `insights_workspaces.conf`) integration, decision log, open questions | **Project context & decisions** |
| `SN_SEARCH_BUILD_LIST.md` | The 98 candidate searches decomposed from all 4 xlsx tabs, cross-checked against SCAN, with build status per item | **"What to build" master inventory** |
| `SN_SEARCHBASE_BUILD_LOG.md` | Running record of what's actually been added to `searchbase.conf` (29 `secure_networking_` stanzas) + the ~60-panel field-reference dashboard inventory (reverse-engineered from screenshots, scrubbed) + the buildability audit corrections | **Build status + panel catalog** |
| `SN_SEARCHBASE_NEXT_BUILD_PLAN.md` | Next working build queue (P0/P1) translating meeting/launch-doc guidance into a prioritized order. **Note: not authored in the main build session — likely a parallel workstream; reconcile with the others if they diverge.** | **Prioritized build queue** |
| `SN_GAP_ANALYSIS.md` | First-pass gap analysis (Secure Networking Pillars tab only). **Superseded by `SN_SEARCH_BUILD_LIST.md`** but kept for its reviewer-comment sourcing | (historical) |
| `SN_SOURCETYPE_REFERENCE.md` | Full extract of SCAN (`splunk-cisco-app-navigator`) `products.conf` — 68 SN-flagged products with status/support_level/addon/sourcetypes | **Sourcetype ↔ TA ↔ support-level lookup** |
| `VISUALIZATION_MAPPING.md` | Team-provided keyword-match report (57 requirements, ~2779 matched panels). **Mostly keyword noise — a lead list, not ground truth.** Always verify a match is real before trusting it | (lead list) |
| `SN_Pillar_Deep_Dive_v1.csv` / `.xlsx` | Team-provided Phase-1 priority tab (per-pillar tech + Phase 1/2 tags) | **Phase-1 priority source** |

Also present: `Splunk and SN Personas and Pillars.pptx`, `SN Splunk Use Case mapping.xlsx` (Chris's source docs), `GSX Accelerator...remediation.pdf`, `Novo Nordisk - Customer Video - GSX.pdf`.

## Where each session topic landed (completeness map)

- 5 pillars / personas / reference architecture → `SN_EVENT_SCOPING.md`
- App/TA inventory (11+ repos, `/opt/splunk/etc` tiers, `/opt/10` live instance) → `SN_EVENT_SCOPING.md` + memory `sn_app_ta_inventory`
- Use-case gap analysis (all 4 xlsx tabs) → `SN_SEARCH_BUILD_LIST.md`
- SCAN product catalog + the pillar-taxonomy-mismatch finding → `SN_SOURCETYPE_REFERENCE.md` + `SN_EVENT_SCOPING.md`
- Standup + exec thread (TA-ownership risk, org decisions, GSX/9-9 timeline, distribution) → `SN_EVENT_SCOPING.md`
- TA remediation PDF + Novo Nordisk customer story → `SN_EVENT_SCOPING.md`
- Insights Secure Networking workspace (21 explicit tile entries + 5 shared layout sections) → `SN_EVENT_SCOPING.md`
- Searches actually built (29 stanzas) + field-dashboard panel inventory (~60) + demo-data asks + buildability audit → `SN_SEARCHBASE_BUILD_LOG.md`
- `app_cisco_common#19` bug (broken SGT lookup) → `SN_SEARCH_BUILD_LIST.md` + `SN_SEARCHBASE_BUILD_LOG.md`

## Confirmed gaps / awaiting input (as of 2026-07-21)

- **Synthetic-sourcetype decision** for the non-TA tail (CMDB/remediation, per-command config audit, SGACL logging) — gates ~40 field-dashboard panels. **Open.**
- **SharePoint Phase-1 folders** (`Secure Networking GSX` / `GTM` / `Sales Play`) are OneDrive cloud stubs, not downloaded — the actual Phase-1 focus material is unreadable until synced. **Open.**
- Demo-data asks: wired-MAB volume (one port, many MACs), virtual-interface MACs, `cisco:sdwan:sgacl:logs`, `cisco:dc:aci:class` ACL-log events. **Open.** DLP, RaVPN, SGT bindings, and Intersight advisory samples have landed and now have live-export-validated searchbase stanzas; the current `/opt/10` search window still returns no rows for those newly seeded sourcetypes.

## Sensitivity

Some material (Webex transcript, field-dashboard screenshots) came from a real customer engagement. Committed files here contain **only generic technical content** — panel titles, field names, viz types, public vendor OUI prefixes. No customer org/facility/division/hostname identifiers. A scrub audit (2026-07-21) confirmed the committed build files clean; keep it that way.
