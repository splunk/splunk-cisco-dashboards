# Sourcetype SPL Audit

**Generated:** `2026-05-23T11:07:24-0400`  **Inventory window:** `-7d` &rarr; `now`  **Inventory generated:** `2026-05-23T11:07:24-0400`

Per-stanza audit of `searchbase.conf` against the discovered field inventory in `sourcetype_field_inventory.json`. A finding means the stanza references a field that is **not** in the discovered field set for any of its sourcetypes, **and** is not a Splunk built-in, a `field_list`-suppressed field, a well-known CIM alias, or synthesized earlier in the same SPL (`eval`, `rename ... as`, `stats ... as`, `lookup ... OUTPUT`, `rex (?<name>...)`).

**Heuristic scope (intentionally narrow):**

- Only fields referenced via `stats|eventstats|streamstats|chart|timechart|tstats <fn>(<field>)`, `... by <field>`, `rename <field> as ...`, or `dedup <field>...` are inspected. Field references inside `eval` / `where` expressions are skipped (parsing them reliably needs a real SPL grammar).
- Stanzas whose sourcetypes returned `empty` / `fail` in the inventory are skipped - we have no ground truth to compare to.
- Pure `| makeresults` stanzas (no sourcetype query) are skipped - they invent their fields by definition.
- CIM data model references (`All_Traffic.dvc`, `Authentication.action`, etc.) are auto-suppressed. They can only be validated against an accelerated data model, not against raw event fields.
- Standard CIM field aliases (`dest_port`, `src_ip`, `Country`, etc.) are auto-suppressed. They are populated by TA `props.conf` field aliases at search-time, so the discovery search does not see them in raw events.

## Summary

| Metric | Count |
|---|---:|
| Stanzas inspected |    0 |
| Stanzas skipped (no sourcetype) |  169 |
| Stanzas skipped (makeresults / synthetic) |   15 |
| Stanzas skipped (no inventory data) |  339 |
| **Stanzas flagged** | **   0** |

## Findings

No suspicious field references found. Audit clean.

