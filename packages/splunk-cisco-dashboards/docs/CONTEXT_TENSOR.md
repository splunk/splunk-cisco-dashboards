# Context Tensor — the CATALOG layer

> Layer 3 of the SCD framework. See `COMPASS.md` for the QUESTION layer and `MATH.md` for the COMPUTATION layer.

The Tensor is a **6-axis catalog** every panel is tagged against. The catalog has two purposes:

1. **Coverage analysis** — by tabulating panels along the six axes, the audit script can show me where my dashboards have *holes* (e.g. no panel covers `Layer=WAN, Signal=Retainability, Scope=Exec summary`) and where they have *redundancy* (two panels with the identical tensor tuple).
2. **Discoverability** — when an executive asks "what about X?", I can grep the registry for `Signal=X` and find every panel that addresses it, across all four top-level dashboards.

The catalog is a single JSON file: `default/data/ui/views/_compass_tags.json`. The audit script reads it on every run.

---

## The 6 axes

| Axis | Values |
|---|---|
| **Layer** | `Internet`, `WAN`, `LAN`, `Device`, `App`, `UX`, `Building` |
| **Signal** | `Availability`, `Retainability`, `Quality`, `Incident`, `Compliance` |
| **Scope** | `Exec summary`, `Ops drilldown`, `Investigator` |
| **Temporal** | `Realtime`, `Trend`, `SLA rollup` |
| **CompassN** | `Show`, `Identify`, `Project`, `Trace`, `Detect`, `Quantify`, `Forecast` |
| **CompassW** | `top-N`, `timeseries`, `heatmap`, `ranked`, `scorecard`, `playbook` |

`CompassN` and `CompassW` are intentionally redundant with the panel's Compass chips (specifically `VERB-STEM` and `WANT-BACK`). The redundancy lets the audit script index by tensor without parsing the per-chip block, and lets me search for "every scorecard panel" in one query.

### Axis design notes

- **Layer** orders roughly outside-in (`Internet` → `Building`). A panel that genuinely spans layers picks the *narrowest* layer that captures it. A panel that aggregates across layers (e.g. an E-Score composite) uses `App`.
- **Signal** matches the LA28 vocabulary in `MATH.md`. `Compliance` is the only Signal not directly produced by a `scd_*` macro — it lives in saved searches that wrap `cisco:dnac:audit:logs` and the `scd_human_user_filter` macro.
- **Scope** is the audience. **Investigator** is the deepest tier — assume a SOC analyst on-call, not the SVP. Panels targeted to `Investigator` may break the "≤2-sentence description" rule and use a markdown header above the tile group instead.
- **Temporal** is the *time semantic* of the panel, not the dashboard's time-range picker. A `Realtime` panel pins `earliest=-5m`. A `Trend` panel uses the page-level time-range token. A `SLA rollup` aggregates daily (or longer) and ignores the page-level picker.

---

## Sidecar JSON schema

The full schema for `_compass_tags.json`:

```json
{
  "<dashboard_id>": {
    "<panel_id>": {
      "title":       "<human-readable title>",
      "tensor": {
        "Layer":     "<one of the Layer values>",
        "Signal":    "<one of the Signal values>",
        "Scope":     "<one of the Scope values>",
        "Temporal":  "<one of the Temporal values>",
        "CompassN":  "<one of the CompassN values>",
        "CompassW":  "<one of the CompassW values>"
      },
      "macros":      ["<scd_macro_1>", "<scd_macro_2>"],
      "data_source": "<sourcetype or saved-search name>",
      "data_status": "REAL | PLACEHOLDER | MIXED",
      "next_ask":    ["<panel_id_1>", "<panel_id_2>"],
      "compass": {
        "VERB-STEM":     "<value or null>",
        "INTENT":        "<value or null>",
        "THREAT/RISK":   "<value or null>",
        "CONSTRAINT":    "<value or null>",
        "WHAT":          "<value or null>",
        "WHEN":          "<value or null>",
        "STEP":          "<value or null>",
        "COMPARE-TO":    "<value or null>",
        "WHERE":         "<value or null>",
        "WHO":           "<value or null>",
        "CLOCK":         "<value or null>",
        "BLAST-RADIUS":  "<value or null>",
        "WANT-BACK":     "<value or null>",
        "SHOULD":        "<value or null>",
        "NEXT-ASK":      "<value or null>",
        "DECISION":      "<value or null>"
      },
      "adversary": {
        "<inverted-compass block>": "<security panels only — same shape as compass>"
      }
    }
  }
}
```

### Field rules

- **`<dashboard_id>`** matches the XML filename without extension: `network`, `devices`, `security`, `executive_overview`. Pilot lives under `network` (it's the first three panels of network.xml).
- **`<panel_id>`** is dot-prefixed by the dashboard id: `network.escore_composite`. The panel id used in the dashboard XML's `visualizations` block (`viz_<id>`) must match the suffix.
- **`tensor`** — all six axes are required. No nulls. If you can't pick a value, the panel is too vague.
- **`macros`** — list every `scd_*` macro the panel's saved searches call. The audit cross-checks this against `default/macros.conf`.
- **`data_status`**:
  - `REAL` — primary data source is in the [LOCKED data inventory](../docs/MATH.md#data-inventory) and is expected on the customer environment. Local-dev empty results are tolerated.
  - `PLACEHOLDER` — primary data source is **not yet wired** in the customer environment. Panel must use the `[DATA-GAP]` title prefix and a markdown explanation.
  - `MIXED` — at least one data source is REAL and at least one is PLACEHOLDER. Panel must clearly mark which fields come from which (footer markdown is fine).
- **`next_ask`** — array of panel ids the user should consult next. Each must resolve to a panel in this catalog. The audit fails if any does not.
- **`compass`** — all 16 chips. Use literal `null` for chips that are genuinely not applicable.
- **`adversary`** — required for security panels that map a kill-chain step. Same shape as `compass`.

### Validation rules (enforced by `audit_compass.py`)

1. JSON is well-formed and validates against the schema above (every required key present, every enum value valid).
2. MVC8 corners are all populated (chip ≠ `null` for at least one chip per corner: N, E, S, W).
3. `tensor` tuples are unique within a dashboard.
4. Every `next_ask` resolves to a real panel id (current dashboard or any other).
5. Every `macros` entry resolves to a real macro stanza in `default/macros.conf`.
6. Every panel in `_compass_tags.json` exists in the corresponding dashboard XML, and vice versa.

The audit prints findings as Markdown to stdout and exits with code 1 if any rule fails.

---

## Layer × Signal coverage matrix template

A useful audit output is the per-dashboard Layer × Signal heatmap. Empty cells flag genuine gaps; dense cells flag potential redundancy. Template:

```
            Avail  Retain  Quality  Incid  Compl
Internet      .      .       .       .      .
WAN           .      .       .       .      .
LAN           .      .       .       .      .
Device        .      .       .       .      .
App           .      .       .       .      .
UX            .      .       .       .      .
Building      .      .       .       .      .
```

Cell value = number of panels covering that (Layer, Signal) tuple. The audit fails the `network` dashboard at Gate 3b if it covers fewer than four distinct cells (the prompt's tensor-coverage minimum).

---

## Empty registry skeleton

The Gate 1 deliverable is the empty registry that Gate 3a populates with the pilot's three panels:

```json
{
  "network":            {},
  "devices":            {},
  "security":           {},
  "executive_overview": {}
}
```

Note `executive_overview` (not `overview`) — the React Overview lives at `pages/executive_insights/index.tsx` and is **not** in the SCD framework's audit scope.
