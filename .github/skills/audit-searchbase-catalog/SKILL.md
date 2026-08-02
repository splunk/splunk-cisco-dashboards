---
name: audit-searchbase-catalog
description: 'Production-audit and curate Searchbase catalogs and harvested Splunk dashboard searches. Use to remediate low-value, base, post-process, KPI, or dashboard-plumbing searches and escalate only unresolved keep/merge/delete decisions; assess bare keyword or free-text filters with a verified field-first preference; remove dashboard tokens and match-all residue; consolidate duplicate or similar SPL; preserve data models; improve metadata; and validate searches safely in Splunk.'
argument-hint: '[searchbase.conf path or dispatch context]'
---

# Audit Searchbase Catalog

Produce a high-fidelity customer-facing catalog, not a literal dashboard export. Treat dashboard XML as provenance. Prefer validated production SPL when the catalog already contains deliberate runtime repairs.

## Independent Catalog Value Gate

Harvesting proves that a search existed in a dashboard; it does not prove that the search belongs in a reusable catalog. Review every harvested search for independent operational value before retention, metadata enrichment, or deletion.

Classify each search as one of:

- **KEEP**: Answers a distinct operational or investigative question, has enough entity/time/source context to interpret the result, and supports a concrete follow-up action outside its source dashboard.
- **MERGE**: Contains useful logic or coverage, but a richer canonical search can preserve that value through fields, grouping, parameters, or drilldown detail.
- **REVIEW DELETE**: Primarily dashboard plumbing, a hidden base/post-process parent, a token feeder, a single unlabeled count, a trivial macro plus `stats`/`timechart`, or a panel fragment whose meaning depends on neighboring dashboard context.

High-value evidence includes unique data-model or source coverage, meaningful filters, entity-level detail, severity/cause/action context, trend or baseline semantics, reusable investigation pivots, and remediation supported by the actual output. Search length alone is not evidence of value; a concise search may still be high value when it computes a well-defined KPI with thresholds and a useful drilldown.

Low-value signals include:

- Generic generated prose such as "reports ... from the dashboard" or remediation that could apply to any result.
- A result that is only `count`, `dc(field)`, or `timechart count by field` without a defined KPI, threshold, baseline, entity context, or investigation path.
- A raw base search whose only purpose is to feed post-process panels.
- Multiple panel variants that differ only by a `by` field and are better represented by one richer detail or parameterized trend search.
- Inventory totals that provide no health, change, ownership, location, or drilldown context and duplicate a richer inventory search.
- A search whose useful source macro or data model is already preserved by a higher-fidelity retained search.

## Field-First Filter Review

Treat bare terms and quoted phrases such as `"DeviceConnector"`, `"deviceConnected"`, or `"failed"` as fidelity-review candidates, not automatic defects. Prefer structured field predicates when they express the same intent and are supported by evidence.

For each free-text discriminator:

1. State the intended event class or condition.
2. Inspect deployed `props.conf`/`transforms.conf`, source-app SPL, `fieldsummary`, and bounded representative events for a stable extracted field.
3. Prefer an exact field predicate, `IN (...)`, or `where isnotnull(field)` when the field's extraction and coverage are verified. Do not reintroduce `field=*`.
4. Compare bounded counts and representative field coverage between the original and proposed filters before rewriting.
5. Retain the raw term when message text is the only reliable discriminator, when the source format has no stable field, or when the extraction itself depends on that literal. Document that evidence in `explanation` or `related_info`.
6. If data is unavailable or equivalence cannot be proven, do not invent a field filter. Keep the original search unchanged and add it to the user decision ledger with a **REWRITE REVIEW** recommendation.

The presence of output fields does not by itself prove that they can replace a raw discriminator. Verify whether the field identifies the event class, merely describes matching events, or is populated only because a raw-term-dependent transform matched. Assess filter fidelity separately from catalog value: a technically valid keyword search can still be **MERGE** or **REVIEW DELETE** when it is only one of many shallow dashboard panel variants.

For Simple XML base/post-process chains, resolve and assess the complete child searches. Record the parent lineage, but do not retain the raw base parent as a standalone catalog item unless it independently satisfies **KEEP**. Never discard unique data-model, macro, source, or sourcetype coverage merely because the originating panel is low value; preserve that coverage in a reviewed **KEEP** or **MERGE** replacement.

Before deleting or omitting any **MERGE** or **REVIEW DELETE** candidate, verify dashboard, drilldown, saved-search, Searchbase, and post-process references. Treat an explicit user example described as junk, low value, unwanted, or something to find and fix as authorization to remove that example and other clear, unreferenced instances of the same reviewed defect class when richer coverage exists. Execute those clear remediations and report them; do not stop after updating this skill. For ambiguous candidates, referenced searches, merges requiring new semantics, or unique source/data-model coverage, present a decision ledger containing: stanza ID, source dashboard/panel, concise SPL shape, dependency/reference status, value assessment, richer retained replacement when applicable, and recommendation. Ask the user to choose **keep**, **merge**, or **delete** only for those unresolved decisions. The default for an unresolved candidate is **keep unchanged**.

## Safety Rules

- Scope the first pass by an explicit stanza prefix, dispatch context, source app, or file.
- Never restart Splunk.
- Before live execution, reject searches containing `collect`, `delete`, `outputlookup`, `outputcsv`, `sendemail`, `fit`, `apply`, or another write/side-effect command.
- Use read-only, bounded time ranges and result counts for live validation.
- Preserve macros, eventtypes, source constraints, data models, acceleration settings, and meaningful wildcard patterns unless evidence proves they are wrong.
- Parse XML with `defusedxml`, reject DTDs/entities/external references, and cap input size.
- Do not add credentials, tokens, certificates, or private keys to source or commands.

## Audit Procedure

1. Parse the catalog with the repository formatter/parser. Do not use ad hoc line splitting for multiline SPL.
2. Inventory the scoped stanzas: IDs, names, SPL, metadata, data models, macros, source types, visualization roles, and drilldown references.
3. Apply the independent catalog value gate. Immediately remediate explicitly authorized and clear instances; produce a decision ledger only for unresolved candidates before deleting, omitting, or merging them.
4. Locate the owning harvester or generator. Fix recurring defects there before rewriting generated output.
5. Review bare keyword and phrase filters using the field-first procedure. Rewrite only when structured-field equivalence is supported by extraction and bounded runtime evidence; otherwise send the candidate to the user decision ledger unchanged.
6. Remove unresolved dashboard tokens and exact match-all predicates such as `field=*`, `field="*"`, `field='*'`, or token-derived `field IN $token$`.
7. Remove now-empty `search`/`where` stages and dangling Boolean operators while retaining neighboring static predicates.
8. Whenever the `search` string changes for any reason, review that stanza's `description`, `explanation`, `solution`, and `related_info`. Update each field when needed so it accurately describes the final SPL, output fields, operational meaning, recommended response, provenance, and related searches. Record that the review occurred even when no prose change is required.
9. Preserve meaningful patterns such as `node="*leaf*"`, `dn="*/sys/health"`, and intentional source wildcards.
10. Canonicalize SPL with the repository formatter and remove exact duplicates. Before deletion, verify references and select the clearest, most reusable metadata.
11. Serialize searches through the repository stanza formatter. In `searchbase.conf`, every physical line of a multiline `search` except the final line must end with a continuation backslash (`\\`) flush against the final SPL character. Never write logical `format_search()` output directly into the file; use the stanza/search-field serializer that emits continuations.
12. Generate near-duplicate candidates with normalized TF-IDF cosine similarity, a length penalty, and a minimum shared-term threshold. Searchbase's reference formula is:

   $$s(a,b)=\cos(a,b)\left(\frac{\min(|a|,|b|)}{\max(|a|,|b|)}\right)^{0.5}$$

13. Review every candidate semantically. Keep both searches when they differ by source/sourcetype, success/failure, severity, direction, aggregation, grouping, output fields, visualization, drilldown role, or operational intent. Similarity scores nominate candidates; they never authorize deletion.
14. Improve generic or dashboard-bound names and prose. Metadata must describe the independent search's actual output and remediation use.
15. Regenerate provenance/manifest metrics, distinguishing source dashboard searches from retained curated catalog searches.

## Validation Gates

- Focused tests for the harvester and cleanup logic pass.
- Scoped catalog has zero unresolved dashboard tokens.
- Scoped catalog has zero exact bare-star predicates.
- Scoped catalog has zero exact canonical-SPL duplicate groups.
- Every bare keyword or phrase filter has a recorded field-first review: verified structured rewrite, documented raw-term justification, or unresolved **REWRITE REVIEW** decision.
- Every harvested search has an independent-value classification. Every omission, merge, or deletion has verified reference status and either direct user authorization, inclusion in an explicitly authorized clear defect class, or a recorded decision for an unresolved candidate.
- Raw base searches are retained only when independently valuable; resolved child searches preserve any unique source, sourcetype, macro, and data-model coverage.
- All source data models remain represented unless a reviewed duplicate was removed.
- Every changed `search` has a documented review of `description`, `explanation`, `solution`, and `related_info`; all four fields remain accurate for the final SPL, even when the review requires no text changes.
- Every non-final physical line of every multiline `search` ends with `\\`; run a catalog-wide continuation scan after writing, including formatting-only changes.
- Formatter check and `git diff --check` pass.
- Diagnostics for changed scripts and catalog files are clean.
- Representative searches across macros, eventtypes, data models, syslog, lookups, subsearches, and joins execute read-only without SPL errors.
- Empty results are classified separately from parser, schema, macro, permission, or dispatch errors.

## Reporting

Report the scoped count before and after, independent-value classification totals, field-first filter review totals and unresolved rewrite candidates, authorization and decision records for removals or merges, exact duplicates removed, near-duplicate decisions, wildcard residue, data-model count/models, live-validation outcomes, and any unrelated pre-existing failures. Include how many changed searches had their four prose fields reviewed and which stanzas required prose updates. Explain why high-scoring searches were retained when their operational intent differs.