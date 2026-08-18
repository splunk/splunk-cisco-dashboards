# Data Compass — the QUESTION layer

> Layer 1 of the SCD framework: **Compass = the QUESTION**, LA28 = the COMPUTATION (see `MATH.md`), Tensor = the CATALOG (see `CONTEXT_TENSOR.md`).

Every panel in Splunk Secure Networking Essentials (SCD) is specified along **16 chips** drawn from four cardinal points: **N**orth Star, **E**vidence, **S**ituation, **W**ant-back. The 16 chips collectively answer "Why are we asking? What signal proves it? Where, who, when by? What shape of answer?"

A panel that cannot answer at least eight of the sixteen chips — covering the four corners listed in **MVC8** below — is not a real executive panel. The audit script (`scripts/audit_compass.py`) flags such panels and fails the build.

---

## The 16 chips

### N — North Star (WHY ARE WE ASKING?)

| Chip | Examples |
|---|---|
| **VERB-STEM** | Show / Identify / Project / Trace / Detect / Quantify / Forecast |
| **INTENT** | confirm / contain / restore / preempt / triage / harden / decide |
| **THREAT/RISK** | exfiltration / lateral move / priv-esc / cred abuse / config drift |
| **CONSTRAINT** | read-only / in-window / cost-bounded / reversible / regulator-safe |

### E — Evidence (WHAT SIGNAL PROVES IT?)

| Chip | Examples |
|---|---|
| **WHAT** | flows+bytes / API calls / DNS / logins / errors / latency |
| **WHEN** | last 5/30/90 min / past 24h / since 0900 / sliding 7-day |
| **STEP** | at the edge / gateway / host / SIEM / WAF / egress NAT / IdP |
| **COMPARE-TO** | vs 7-day p95 / last week / SLO / allow-list / threat-intel / last-known-good |

### S — Situation (WHERE, WHO, WHEN BY?)

| Chip | Examples |
|---|---|
| **WHERE** | at the venue / press center / athlete net / cloud tenant / OT zone |
| **WHO** | service account / vendor SaaS / contractor / agentic AI / IoT device |
| **CLOCK** | before opening / before puck-drop / next window / inside 15-min SLA |
| **BLAST-RADIUS** | one host / a VLAN / a venue / every scope / broadcast pipeline |

### W — Want-back (WHAT SHAPE OF ANSWER?)

| Chip | Examples |
|---|---|
| **WANT-BACK** | top-10 / time-series / heatmap / ranked anomalies / playbook draft |
| **SHOULD** | against allow-list / policy / SOP / SLO / last-known-good |
| **NEXT-ASK** | who else affected / known TTP / root cause / fastest revert |
| **DECISION** | approve / hold / contain / rollback / escalate / quarantine |

---

## MVC8 — the minimum coverage rule

Every panel must populate at least one chip on each cardinal corner:

```
                  N
            VERB-STEM
              INTENT
                  |
   W ----- WANT-BACK + NEXT-ASK ----- E   (WHAT + WHEN)
                  |
            WHERE + BLAST-RADIUS
                  S
```

Eight chips, one on each side of each corner. A panel missing any of the eight either:

1. is too vague to be actionable, **or**
2. is missing a data wiring (e.g. no NEXT-ASK because no drilldown exists yet).

Both conditions are real bugs the audit script must surface.

### Special rule: NEXT-ASK closes the loop

`NEXT-ASK` must point to a **panel that exists or is planned in this app**. The audit script fails the build if a panel names a NEXT-ASK target that has no corresponding panel id in `_compass_tags.json`. This is what keeps "Open issues by site → who else is affected" from being a slogan and makes it a real drilldown.

### Adversary mode (security panels only)

Security panels that map a kill-chain step also tag the **inverted compass** alongside the defender's. XDR / threat-hunting tiles should render two compass radials side-by-side: one from the defender's view ("Detect lateral move within 15-min SLA") and one from the adversary's view ("Pivot to athlete VLAN before opening").

The audit script does not yet enforce inverted-compass coverage — it's a quality bar, not a hard fail.

---

## COMPARE-TO → SPL macro mapping

The **COMPARE-TO** chip on the Evidence corner is the most opinionated chip in the framework, because it determines which canonical macro the panel calls. The mapping is one-to-one:

| COMPARE-TO chip value | Canonical macro | Output fields |
|---|---|---|
| `vs 7-day p95` | `scd_compare_p95(metric_field, by_field)` | `baseline_p95`, `delta_from_p95` |
| `last week` | `scd_compare_p95(metric_field, by_field)` (with `earliest=-7d@d`, `latest=-1d@d` overlay) | `baseline_p95`, `delta_from_p95` |
| `SLO` | `scd_uptime_sla(availability_field, target_pct)` | `uptime_pct`, `breached` |
| `allow-list` | `scd_compare_allowlist(lookup_name, key_field)` | `is_outside_allowlist` |
| `threat-intel` | `scd_compare_allowlist(lookup_name, key_field)` (negative form: present in lookup = bad) | `is_outside_allowlist` |
| `last-known-good` | `scd_compare_lkg(metric_field, by_field)` | `lkg`, `delta_from_lkg` |

When the COMPARE-TO chip is `none` (e.g. an inventory table that just lists devices), the panel does not call a comparison macro. The panel is still required to satisfy MVC8 — `none` is a valid chip value, not a missing one.

If a panel needs a comparison the table doesn't cover, **stop and tell me**. Do not invent a 12th comparison macro. The math layer is closed at 11 macros — see `MATH.md`.

---

## Worked example — one panel through all three layers

Here is **Pilot Panel 3 — Network E-Score Composite** specified end-to-end. This is the canonical example of what a fully-spec'd SCD panel looks like.

### Layer 1 — Compass (the QUESTION)

| Cardinal | Chip | Value |
|---|---|---|
| N | VERB-STEM | Quantify |
| N | INTENT | decide |
| N | THREAT/RISK | *(null — composite KPI, not a threat)* |
| N | CONSTRAINT | read-only |
| E | WHAT | composite of availability + retainability + quality |
| E | WHEN | sliding 7-day |
| E | STEP | aggregate across all DNAC-managed devices |
| E | COMPARE-TO | none |
| S | WHERE | every Region site |
| S | WHO | network operations team |
| S | CLOCK | continuous |
| S | BLAST-RADIUS | every scope |
| W | WANT-BACK | scorecard |
| W | SHOULD | against SLO 99.5% |
| W | NEXT-ASK | per-site E-Score breakdown (panel `network.per_site_escore` — added at Gate 3b) |
| W | DECISION | approve / hold / escalate |

**MVC8 check:** ✓ all four corners populated (Quantify+decide / composite+sliding-7d / every-Region-site+every-scope / scorecard+per-site-escore).

### Layer 2 — LA28 (the COMPUTATION)

```spl
| inputlookup site_dnac_health.csv
| `scd_quality_score(p95_latency_ms)`
| `scd_retainability(error_count, total_count)`
| `scd_escore(availability, retainability, quality, $w_a$, $w_r$, $w_q$)`
| stats avg(escore) as composite_escore
```

Tokens `$w_a$ / $w_r$ / $w_q$` are driven by a **dropdown input** with three named presets (`balanced`, `la28`, `emergency_ops`) plus a `custom` row that shows three numeric inputs. See `MATH.md` for the preset table.

### Layer 3 — Tensor (the CATALOG entry)

```json
{
  "panel_id": "network.escore_composite",
  "title": "Network E-Score Composite",
  "tensor": {
    "Layer":    "App",
    "Signal":   "Quality",
    "Scope":    "Exec summary",
    "Temporal": "SLA rollup",
    "CompassN": "Quantify",
    "CompassW": "scorecard"
  },
  "macros":      ["scd_quality_score", "scd_retainability", "scd_escore"],
  "data_status": "MIXED",
  "next_ask":    ["network.per_site_escore"],
  "compass":     { "VERB-STEM": "Quantify", "...": "..." }
}
```

The audit script reads `_compass_tags.json` plus the dashboard XML and checks:
- this panel exists in both
- the tensor tuple is unique within `network.xml`
- the `next_ask` target (`network.per_site_escore`) resolves to a real registered panel
- MVC8 chips are all populated
- every macro listed under `macros` is defined in `default/macros.conf`

If any of those fail, the audit reports the panel id, the failing check, and the line.

---

## How to use this doc

When proposing a new panel, fill in **all 16 chips** of the Compass before writing any SPL. If a chip is genuinely null, write `null` — never invent a value to satisfy MVC8. Surface those nulls in the storyboard (`docs/storyboard_<dashboard>.md`); I'll either fix the data wiring or downgrade the panel to a `[DATA-GAP]` placeholder.

The Compass chips are documentation: they end up in the `compass` block of the panel's `_compass_tags.json` entry. They are not magic strings — the audit script only enforces MVC8 *coverage*, not the chip *values* (the values are reviewed manually during storyboard approval).
