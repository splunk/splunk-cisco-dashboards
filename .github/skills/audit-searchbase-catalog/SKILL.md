---
name: audit-searchbase-catalog
description: 'Production-audit, optimize, and curate Searchbase catalogs and harvested Splunk dashboard searches. Use to replace eventtype-only bases with local index and sourcetype constraints; remove table-star and premature transforming commands; filter rows and fields early; remediate low-value dashboard plumbing; assess free-text filters; adapt searches to local macros and dispatch ownership; consolidate duplicates; preserve data models; improve metadata; and validate searches safely in Splunk.'
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

## Output Projection Review

Do not preserve a terminal `fields` or `table` merely because it appeared in a dashboard. Remove a terminal projection only when it is provably a no-op: the immediately preceding transforming command has a complete, deterministic output schema and the projection exactly repeats that schema without changing order or names. One safe example is a non-split `timechart` with explicit aliases followed by `fields _time` plus exactly those aliases.

Preserve the projection when it narrows wildcard or split-series output, removes temporary fields, establishes a deliberate column order, supports a downstream command, or follows any command that may add or retain fields, including `predict`, anomaly commands, `addtotals`, `join`, `append`, `appendcols`, or a subsearch. Do not blanket-remove terminal `fields` or `table`; uncertain cases remain unchanged and enter **REWRITE REVIEW**.

Never use `table *`. It retains every field while introducing a reporting boundary that can move processing to the search head. Remove an exact `table *`; if early column reduction is useful, replace it with a streaming `fields` command containing only fields required downstream. Use an explicit `table field1 field2 ...` only as the final presentation command unless a documented semantic dependency requires otherwise. Do not mechanically move a mid-pipeline `table`: first determine which fields subsequent commands require, then replace it with `fields`, move it to the end, or preserve it for **REWRITE REVIEW**.

## Search Performance Optimization

Optimize every harvested or reviewed search as production SPL, not as a literal copy of dashboard SPL. The governing principles are: retrieve only required data, move as little data as possible, preserve indexer parallelism, and use the narrowest operationally correct time range.

### Base Search And Bucket Elimination

1. Every raw-event search starts with an app-owned index macro such as `index_dc`, followed immediately by the narrowest verified `sourcetype`, `source`, or `host` constraints. Do not start a catalog search with `eventtype=`, a bare keyword, or an unrestricted search.
2. Resolve a leading eventtype through deployed `eventtypes.conf` or `btool`. Inline its index and sourcetype into the base search using local macros, preserve meaningful positive predicates, and remove match-all terms such as `severity=*`. If the eventtype contains semantic logic that cannot be represented independently, record **REWRITE REVIEW** rather than silently weakening it.
3. Put stable field-value predicates on the first line whenever they can be evaluated before later commands. Prefer indexed/default fields for bucket elimination; use `<field>::<value>` only after verifying the field is indexed. Search-time extracted fields may still reduce events early, but do not describe them as indexed without evidence.
4. Prefer exact positive matches. Review leading wildcards, broad OR lists, `NOT`/`!=`, phrase searches, and expensive regexes. Use `TERM(...)` only when event segmentation evidence proves it matches the intended literal. Preserve necessary wildcards and negative logic when no equivalent positive predicate exists.
5. Keep time bounds as narrow as the operational question permits. Respect dispatch-time ranges when Searchbase owns the time picker; do not hardcode a narrower range that changes search meaning.

### Pipeline Ordering And Data Movement

1. Filter rows before calculations: move independent `search`/`where` predicates ahead of `eval`, `lookup`, `rex`, `foreach`, aggregation, and enrichment. Keep predicates after the command that creates the field they require.
2. Reduce columns early with `fields required_field ...` and optionally `fields - _raw` when the downstream field dependency set is complete. Never remove `_raw` before a later extraction or command needs it, and do not add an early `fields` command when transforming commands already enforce a smaller schema.
3. Keep non-streaming and transforming commands such as `stats`, `chart`, `timechart`, `sort`, `dedup`, `top`, `append`, and explicit `table` as late as semantics allow. Once processing centralizes on the search head, later filters cannot recover indexer parallelism.
4. Review `join`, `append`, `appendcols`, `transaction`, and subsearches for extra indexer trips, truncation limits, and timeout risk. Prefer a single OR base plus conditional `stats` when it is semantically equivalent; never rewrite correlation mechanically when cardinality or event pairing would change.
5. Use `tstats` only for indexed fields, metrics, or valid data-model datasets. Prefer accelerated data models or summaries for repeated high-volume reporting, but verify that the summary-producing and consuming searches are themselves selective.
6. Combine adjacent compatible calculations, avoid repeated sorting/deduplication, and limit result cardinality only when doing so preserves the operational answer.
7. Use Job Inspector or equivalent telemetry for material rewrites when representative data exists. Compare scan count, event count, bucket elimination, result count/schema, runtime, remote search, and search-head versus indexer work. Parser success alone is not performance evidence.

Treat these as evidence-driven optimization constraints, not permission to alter results. Compare bounded original and rewritten searches; preserve output fields, grouping, time semantics, null handling, and cardinality unless the catalog review explicitly intends a behavioral change.

## Macro And Dispatch Ownership

Apply this policy to every search harvested or added to `searchbase.conf`, regardless of source app:

1. Inventory the source search's index macros, acceleration macros, structural macros, eventtypes, lookups, data models, and custom commands.
2. Prefer an equivalent macro already defined in this app's `default/macros.conf`. In this repository, use domain macros such as `index_catalyst` and `index_dc`, and use `scd_summariesonly` for `tstats` acceleration behavior.
3. Preserve all source constraints when adapting a macro. If no local index macro covers a real data domain, add one with a precise sourcetype-domain description instead of retaining a foreign index macro or hardcoding an index.
4. Set `dispatch_context = splunk-cisco-dashboards` by default. A source dashboard's app context is provenance, not evidence that dispatch must remain there.
5. Retain a foreign dispatch context only after verifying a required dependency is app-local and not exported to this app. Record the exact blocking macro, eventtype, lookup, data model, command, or permission in the audit report.
6. Verify visibility with app metadata or `btool`, then execute representative bounded searches from `splunk-cisco-dashboards`. Do not infer visibility from the source app name alone.
7. Keep exported source structural objects when no local equivalent exists; global visibility means they do not require foreign dispatch. Never copy a large source macro into this app solely to change dispatch context.

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
5. Apply the complete performance optimization review: base index/sourcetype selectivity, eventtype independence, early row and column reduction, command ordering, wildcard/negative logic, correlation commands, cardinality, acceleration opportunities, and time scope.
6. Review bare keyword and phrase filters using the field-first procedure. Rewrite only when structured-field equivalence is supported by extraction and bounded runtime evidence; otherwise send the candidate to the user decision ledger unchanged.
7. Remove unresolved dashboard tokens and exact match-all predicates such as `field=*`, `field="*"`, `field='*'`, or token-derived `field IN $token$`.
8. Remove now-empty `search`/`where` stages and dangling Boolean operators while retaining neighboring static predicates.
9. Review field projections, remove every exact `table *`, and remediate premature explicit `table` commands using the rules above.
10. Normalize macros and dispatch context using the ownership policy above.
11. Whenever the `search` string changes for any reason, review that stanza's `description`, `explanation`, `solution`, and `related_info`. Update each field when needed so it accurately describes the final SPL, output fields, operational meaning, recommended response, provenance, and related searches. Record that the review occurred even when no prose change is required.
12. Preserve meaningful patterns such as `node="*leaf*"`, `dn="*/sys/health"`, and intentional source wildcards.
13. Canonicalize SPL with the repository formatter and remove exact duplicates. Before deletion, verify references and select the clearest, most reusable metadata.
14. Serialize searches through the repository stanza formatter. In `searchbase.conf`, every physical line of a multiline `search` except the final line must end with a continuation backslash (`\`) flush against the final SPL character. Never write logical `format_search()` output directly into the file; use the stanza/search-field serializer that emits continuations.
15. Generate near-duplicate candidates with normalized TF-IDF cosine similarity, a length penalty, and a minimum shared-term threshold. Searchbase's reference formula is:

   $$s(a,b)=\cos(a,b)\left(\frac{\min(|a|,|b|)}{\max(|a|,|b|)}\right)^{0.5}$$

16. Review every candidate semantically. Keep both searches when they differ by source/sourcetype, success/failure, severity, direction, aggregation, grouping, output fields, visualization, drilldown role, or operational intent. Similarity scores nominate candidates; they never authorize deletion.
17. Improve generic or dashboard-bound names and prose. Metadata must describe the independent search's actual output and remediation use.
18. Regenerate provenance/manifest metrics, distinguishing source dashboard searches from retained curated catalog searches.

## Validation Gates

- Focused tests for the harvester and cleanup logic pass.
- Scoped catalog has zero unresolved dashboard tokens.
- Scoped catalog has zero exact bare-star predicates.
- Scoped catalog has zero exact canonical-SPL duplicate groups.
- No raw-event search starts with `eventtype=`; each verified eventtype base is expressed with an app-owned index macro, explicit sourcetype, and preserved meaningful predicates.
- No search contains `table *`. Every nonterminal explicit `table` has been safely replaced/moved or has a documented **REWRITE REVIEW** record.
- Every raw-event search has the narrowest verified index, sourcetype/source/host, field, and time constraints available without changing its operational meaning.
- Independent filters run before calculations and non-streaming commands as far as field dependencies allow; retained early transforms and expensive correlation commands have documented justification.
- No terminal projection provably repeats the complete output of its immediately preceding transform; all retained ambiguous projections remain unchanged or have a review record.
- Harvested searches use local index and acceleration macros wherever equivalent abstractions exist.
- Dispatch context defaults to `splunk-cisco-dashboards`; every retained foreign context has a recorded non-exported dependency and bounded validation evidence.
- Every bare keyword or phrase filter has a recorded field-first review: verified structured rewrite, documented raw-term justification, or unresolved **REWRITE REVIEW** decision.
- Every harvested search has an independent-value classification. Every omission, merge, or deletion has verified reference status and either direct user authorization, inclusion in an explicitly authorized clear defect class, or a recorded decision for an unresolved candidate.
- Raw base searches are retained only when independently valuable; resolved child searches preserve any unique source, sourcetype, macro, and data-model coverage.
- All source data models remain represented unless a reviewed duplicate was removed.
- Every changed `search` has a documented review of `description`, `explanation`, `solution`, and `related_info`; all four fields remain accurate for the final SPL, even when the review requires no text changes.
- Every non-final physical line of every multiline `search` ends with `\\`; run a catalog-wide continuation scan after writing, including formatting-only changes.
- Formatter check and `git diff --check` pass.
- Diagnostics for changed scripts and catalog files are clean.
- Representative searches across macros, eventtypes, data models, syslog, lookups, subsearches, and joins execute read-only without SPL errors.
- Material performance rewrites have bounded result-count/schema equivalence and, where representative data exists, Job Inspector or equivalent scan/runtime evidence.
- Empty results are classified separately from parser, schema, macro, permission, or dispatch errors.

## Optimization References

Use current product documentation as the authority; community guidance is supporting evidence and must be validated against the deployed Splunk version and data model.

- [Write better searches](https://help.splunk.com/en?resourceId=Splunk_Search_Writebettersearches)
- [Write better searches, Splunk Enterprise 9.3](https://help.splunk.com/en/splunk-enterprise/search/search-manual/9.3/optimizing-searches/write-better-searches)
- [Quick tips for optimization, Splunk Enterprise 10.4](https://help.splunk.com/en/splunk-enterprise/search/search-manual/10.4/optimize-searches/quick-tips-for-optimization)
- [About search optimization, Splunk Enterprise 9.1](https://help.splunk.com/en/splunk-enterprise/search/search-manual/9.1/optimizing-searches/about-search-optimization)
- [Writing better queries in SPL](https://lantern.splunk.com/Platform_Data_Management/Transform_Data/Writing_better_queries_in_Splunk_Search_Processing_Language)
- [Optimizing search](https://lantern.splunk.com/Platform_Data_Management/Transform_Data/Optimizing_search)
- [Optimizing searches and dashboards](https://lantern.splunk.com/Splunk_Success_Framework/Improve_Performance/Optimizing_systems_and_knowledge_objects/Optimizing_searches_and_dashboards)
- [Splunk SPL quick reference](https://www.splunk.com/en_us/blog/learn/splunk-cheat-sheet-query-spl-regex-commands.html)
- [Large-scale search performance discussion](https://community.splunk.com/t5/Getting-Data-In/How-to-Optimize-Search-Performance-for-Large-Scale-Data-in/m-p/750130)

## Reporting

Report the scoped count before and after, independent-value classification totals, field-first filter review totals and unresolved rewrite candidates, authorization and decision records for removals or merges, exact duplicates removed, near-duplicate decisions, wildcard residue, data-model count/models, live-validation outcomes, and any unrelated pre-existing failures. Include how many changed searches had their four prose fields reviewed and which stanzas required prose updates. Explain why high-scoring searches were retained when their operational intent differs.
