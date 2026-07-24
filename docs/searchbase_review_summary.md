# Searchbase Review Summary

Generated on 2026-07-23 from `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf`.

| Measure | Count |
|---|---:|
| Searches processed | 918 |
| SPL searches changed | 5 |
| Metadata stanzas changed | 12 |
| Data Model tstats searches | 303 |
| Other tstats searches | 22 |
| Raw searches retained for parity validation | 577 |
| Non-event-source searches | 16 |
| Secure Networking sub-categories preserved | 172 |
| Origin tags removed or renamed | 0 |
| Proposed tag additions, not applied | 153 |
| Remaining static review notes | 486 |

The complete per-search original/optimized SPL, metadata, rationale, classification review, tag proposals, and residual findings are in `docs/searchbase_review_report.json`.

## Applied SPL Changes

Three SGACL Data Model searches now use the defined `scd_summariesonly` macro instead of the undefined `summariesonly` macro. No tags or classifications changed.

## Tag Proposals

The report proposes adding the picker tag `Cisco` to 153 metric-producing timechart searches. These proposals require approval and were not applied. No tag spelling or casing variants were found.

## Validation Boundary

Static validation verifies conf structure, macro references, metadata presence, and known SPL anti-patterns. Raw-to-Data Model conversions remain unchanged where field parity and live result equivalence have not been established.
