# Demo Data Gen App — Sourcetype Audit Findings & Fix Instructions

## Context

A cross-reference audit was performed comparing all sourcetypes emitted by this demo data gen app against the canonical **products.conf** registry in `splunk-cisco-app-navigator` and the **TA props.conf** definitions in `ta_cisco_common`. The audit checked 377 sourcetypes and found **14 that need investigation or correction**.

**Source of truth for valid sourcetypes:**
- `splunk-cisco-app-navigator/packages/splunk-cisco-app-navigator/src/main/resources/splunk/default/products.conf` — the master product-to-sourcetype registry (346+ sourcetypes across TA and SC4S ingestion paths)
- `ta_cisco_common/package/default/props.conf` — the TA's props.conf that defines field extractions per sourcetype (65 stanza definitions)

**Critical rule:** Splunk sourcetypes are **case-sensitive**. A sourcetype of `cisco:foo:Bar` will NOT match a props.conf stanza for `cisco:foo:bar`. If the TA defines it lowercase, the demo data MUST emit it lowercase or no field extractions will fire.

---

## Category 1: CASE BUGS — Fix immediately

These sourcetypes exist in products.conf but with different casing. Since Splunk sourcetypes are case-sensitive, data emitted with the wrong case will not match any `props.conf` stanza and field extractions will silently fail.

| Current (wrong) | Correct (per products.conf) | Action |
|---|---|---|
| `cisco:isovalent:processConnect` | `cisco:isovalent:processconnect` | Rename to all-lowercase |
| `cisco:isovalent:processExec` | `cisco:isovalent:processexec` | Rename to all-lowercase |

**How to fix:** Search the entire codebase for these exact strings (case-sensitive search) and replace with the lowercase versions. Check:
- Any `sourcetype=` assignments in data generation code
- Any sample/seed data files that set sourcetype
- Any configuration stanzas (inputs.conf, props.conf, etc.)
- Any Python/JS constants or mappings that define sourcetype strings

**Verification:** After fixing, grep the entire codebase for `processConnect` and `processExec` (case-sensitive) — there should be zero matches with camelCase.

---

## Category 2: BARE / INCOMPLETE SOURCETYPES — Fix to use real suffixed variants

These are "parent" sourcetype names that no TA actually emits. The TAs always produce suffixed versions. Using the bare name means the demo data won't match any real-world TA behavior.

### `cisco:sdwan` → Should be specific suffixed sourcetypes

The Cisco SD-WAN TA never emits a bare `cisco:sdwan`. It emits these (from products.conf):
```
cisco:sdwan:audit:logs
cisco:sdwan:linkhealth
cisco:sdwan:utd:logs
cisco:sdwan:alarmswarnings
cisco:sdwan:controlconnections
cisco:sdwan:hardwarehealth
cisco:sdwan:devicecounters
cisco:sdwan:systemstatus
cisco:sdwan:interfacestats
```

**Action:** Investigate what data the bare `cisco:sdwan` generator is producing. Based on the event content:
- If it's link/WAN health metrics → rename to `cisco:sdwan:linkhealth`
- If it's audit/config change events → rename to `cisco:sdwan:audit:logs`
- If it's alarm/warning events → rename to `cisco:sdwan:alarmswarnings`
- If it's mixed data that covers multiple categories → split into the correct suffixed sourcetypes
- If it's a catch-all placeholder → remove it and ensure each specific sourcetype has its own generator

### `cisco:xdr` → Should be specific suffixed sourcetypes

The Cisco XDR TA never emits a bare `cisco:xdr`. It emits these (from products.conf):
```
cisco:xdr:incidents
cisco:xdr:incidents-summary
cisco:xdr:incidents-summary:notable
```

**Action:** Investigate what data the bare `cisco:xdr` generator is producing. Based on the event content:
- If it's incident data → rename to `cisco:xdr:incidents`
- If it's summary/rollup data → rename to `cisco:xdr:incidents-summary`
- If it's mixed → split accordingly
- If it's a placeholder → remove and ensure each specific sourcetype has its own generator

---

## Category 3: INVENTED SOURCETYPES — Investigate and likely remove

These sourcetypes do not appear in any products.conf entry, any TA props.conf, or any known Cisco Splunk integration. They may have been created by mistake, copied from an internal prototype, or refer to a product that doesn't have a public Splunk integration.

### `cisco:sbg:*` — Unknown product (4 sourcetypes)

```
cisco:sbg:api:error
cisco:sbg:api:status
cisco:sbg:data
cisco:sbg:resource_usage
```

**Action:** Investigate what "SBG" stands for in this context. Possibilities:
- **If "SBG" = "Secure Business Gateway"** — this is not a recognized Cisco product with a Splunk TA. No products.conf entry exists. These should likely be removed unless there's a private/internal TA that creates them.
- **If these were copied from another project** — remove them.
- **If these are for a planned future product** — mark them clearly as `# FUTURE: pending TA release` and exclude from active demo data generation until a TA exists.

### `cisco:spaces:log` — Wrong sourcetype name

products.conf defines only one sourcetype for Cisco Spaces: `cisco:spaces:firehose`. There is no `cisco:spaces:log`.

**Action:** 
- If this generator produces Cisco Spaces event data → rename to `cisco:spaces:firehose`
- If this was intended to be an internal app log (not Spaces telemetry data) → it should not have the `cisco:spaces:` prefix. Consider removing it or renaming to something that doesn't collide with the Spaces namespace.

### `cisco:sourcefire:appliance:syslog` and `cisco:sourcefire:defencecenter:syslog` — Retired product names

"Sourcefire" was the pre-acquisition name (Cisco acquired Sourcefire in 2013). The current product is **Cisco Secure Firewall** and the current TAs produce:
- `cisco:ftd:syslog` (TA path for Firepower Threat Defense)
- `cisco:ftd` (SC4S path for FTD)
- `cisco:sfw:estreamer` (eStreamer integration)
- `cisco:sfw:policy` (policy data)
- `cisco:asa` (ASA syslog)
- `cisco:firepower:syslog` (SC4S path)

No current TA creates `cisco:sourcefire:*` sourcetypes.

**Action:**
- If the demo data represents FTD/Firepower syslog → rename to `cisco:ftd:syslog`
- If the demo data represents FMC (Firepower Management Center, formerly Defence Center) → this would typically come through eStreamer, so rename to `cisco:sfw:estreamer`
- If these are placeholders with no real event structure → remove them

### `Kepware` — Not a Cisco product

Kepware (now PTC Kepware KEPServerEX) is an OT/ICS connectivity platform. It is not a Cisco product and has no Cisco-published Splunk TA.

**Action:**
- If this was included intentionally for OT/ICS demo scenarios alongside Cisco Industrial Network Director or Cyber Vision → keep it but document that it's a third-party sourcetype
- If it was included by mistake → remove it
- Note: If keeping it, be aware there is no Splunk TA that defines field extractions for a `Kepware` sourcetype, so any demo data won't have structured fields unless you also ship a local props.conf with extractions

---

## Category 4: LEGACY BUT VALID — Keep with documentation

These sourcetypes come from deprecated/superseded TAs but are still valid for customers running older deployments.

| Sourcetype | Status | Notes |
|---|---|---|
| `cisco:estreamer:data` | Legacy eStreamer TA | Superseded by `cisco:sfw:estreamer` in current Secure Firewall TA. Keep for backward compatibility. |
| `cisco:estreamer:log` | Legacy eStreamer TA | Same. Keep for backward compatibility. |

**Action:** No code changes needed. Optionally add a comment in the sourcetype mapping noting these are legacy:
```
# Legacy eStreamer TA sourcetypes — kept for customers on older TA versions
# Current TA equivalent: cisco:sfw:estreamer
```

---

## Verification Checklist

After making fixes, verify:

- [ ] `grep -ri "processConnect\|processExec"` returns zero camelCase hits
- [ ] `grep -ri "cisco:sdwan\b"` shows no bare `cisco:sdwan` without suffix (use word-boundary or manual review)
- [ ] `grep -ri "cisco:xdr\b"` shows no bare `cisco:xdr` without suffix  
- [ ] `grep -ri "cisco:sourcefire"` returns zero hits (unless intentionally kept as legacy)
- [ ] `grep -ri "cisco:spaces:log"` returns zero hits
- [ ] `grep -ri "cisco:sbg"` returns zero hits (unless you identified a valid product)
- [ ] All remaining sourcetypes can be cross-referenced against products.conf

---

## Reference: Products.conf Sourcetype Entries for Affected Products

### Cisco Isovalent (Cilium)
```
sourcetypes = cisco:isovalent,cisco:isovalent:alert,cisco:isovalent:processconnect,cisco:isovalent:processexec,cisco:isovalent:telemetry:network,cisco:isovalent:telemetry:process
```

### Cisco SD-WAN (vManage / Catalyst SD-WAN)
```
sourcetypes = cisco:sdwan:audit:logs,cisco:sdwan:linkhealth,cisco:sdwan:utd:logs,cisco:sdwan:alarmswarnings,cisco:sdwan:controlconnections,cisco:sdwan:hardwarehealth,cisco:sdwan:devicecounters,cisco:sdwan:systemstatus,cisco:sdwan:interfacestats
```

### Cisco XDR
```
sourcetypes = cisco:xdr:incidents,cisco:xdr:incidents-summary,cisco:xdr:incidents-summary:notable
```

### Cisco Spaces
```
sourcetypes = cisco:spaces:firehose
```

### Cisco Secure Firewall (TA path)
```
sourcetypes = cisco:asa,cisco:ftd:syslog,cisco:sfw:estreamer,cisco:sfw:policy
```

### Cisco Secure Firewall (SC4S path)
```
sourcetypes = cisco:asa,cisco:fwsm,cisco:pix,cisco:firepower:syslog,cisco:ftd
```
