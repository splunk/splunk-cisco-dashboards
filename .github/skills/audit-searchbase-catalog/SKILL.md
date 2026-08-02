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

Treat an explicit user example described as junk, low value, unwanted, or something to find and fix as authorization to review every occurrence of the same SPL command or pattern. Use two passes before deleting or omitting any candidate. Pass 1 — Classification: for every occurrence, record its independent value-gate class, the result of the dashboard, drilldown, saved-search, Searchbase, and post-process reference scan, and the stanza ID of richer retained coverage or **NONE**. Pass 2 — Action: when all three fields are resolved, the class is **REVIEW DELETE** or **MERGE**, the occurrence is unreferenced, and a replacement stanza ID is recorded, execute the deletion or merge and report it; do not stop after updating this skill. If any field is **NONE** or uncertain, leave the occurrence unchanged and place it in the decision ledger. Include stanza ID, source dashboard/panel, concise SPL shape, dependency/reference status, value assessment, richer retained replacement when applicable, and recommendation. Ask the user to choose **keep**, **merge**, or **delete** only for those unresolved decisions.

## Output Projection Review

Apply this projection decision order:

1. If the projection is exact `table *`, remove it. If early column reduction is useful, replace it with streaming `fields` containing only fields required downstream.
2. Otherwise remove a terminal projection only when every output field of the immediately preceding transform is a literal, explicitly named alias, with no wildcard, split-by field, dynamic field name, subsearch, or command that can add fields, and the projection repeats exactly those fields in the same order. One safe example is a non-split `timechart` with explicit aliases followed by `fields _time` plus exactly those aliases.
3. Preserve the projection when it narrows wildcard or split-series output, removes temporary fields, establishes column order, supports a downstream command, or follows `predict`, an anomaly command, `addtotals`, `join`, `append`, `appendcols`, or a subsearch.
4. If none of these outcomes is proven, leave the projection unchanged and record **REWRITE REVIEW**.

Use an explicit `table field1 field2 ...` only as the final presentation command unless a documented semantic dependency requires otherwise. Do not mechanically move a mid-pipeline `table`: first determine which fields subsequent commands require, then replace it with `fields`, move it to the end, or preserve it for **REWRITE REVIEW**.

## Search Performance Optimization

Optimize every harvested or reviewed search as production SPL, not as a literal copy of dashboard SPL. The governing principles are: retrieve only required data, move as little data as possible, preserve indexer parallelism, and use the narrowest operationally correct time range.

### Base Search And Bucket Elimination

1. Every raw-event search starts with an app-owned index macro such as `index_dc`, followed immediately by the narrowest verified `sourcetype`, `source`, or `host` constraints. Do not start a catalog search with `eventtype=`, a bare keyword, or an unrestricted search.
2. Resolve a leading eventtype through deployed `eventtypes.conf` or `btool`. Inline its index and sourcetype into the base search using local macros, preserve meaningful positive predicates, and remove match-all terms such as `severity=*`. If the eventtype contains semantic logic that cannot be represented independently, record **REWRITE REVIEW** rather than silently weakening it.
   If `eventtypes.conf` and `btool` output are unavailable in the current session, leave the eventtype unchanged and record **REWRITE REVIEW** stating that resolution requires deployed `btool` access.
3. Put stable field-value predicates on the first line whenever they can be evaluated before later commands. Prefer indexed/default fields for bucket elimination; use `<field>::<value>` only after verifying the field is indexed. Search-time extracted fields may still reduce events early, but do not describe them as indexed without evidence.
4. Prefer exact positive matches. Review leading wildcards, broad OR lists, `NOT`/`!=`, phrase searches, and expensive regexes. Use `TERM(...)` only when event segmentation evidence proves it matches the intended literal. Preserve necessary wildcards and negative logic when no equivalent positive predicate exists.
5. Keep time bounds as narrow as the operational question permits. Respect dispatch-time ranges when Searchbase owns the time picker; do not hardcode a narrower range that changes search meaning.

### Sourcetype Ground-Truth Verification

1. Inventory every literal `sourcetype` used by each search. Confirm exact names against the installed source app's effective `props.conf` or `btool props list`, including local overrides. When the source app is unavailable, require current official vendor or Splunk documentation, a repository fixture/generator that emits that exact sourcetype, or bounded observed events as evidence.
2. A plausible product-prefixed name, an index macro description, generated review report, dashboard copy, or another search using the same literal is not independent evidence that the sourcetype exists.
3. If the literal is unsupported, compare the search's predicates and output fields with verified sourcetypes from the same product. Rename only when field and event semantics match; otherwise leave the stanza unchanged as **REWRITE REVIEW** or remove it only through the independent-value and reference gates.
4. Record the app, file, `btool` output, documentation, generator, or observed-event evidence used. Distinguish "not defined by installed apps" from "fabricated": an optional TA absent from the current host requires further evidence, not automatic deletion. If a sourcetype belongs to a known optional TA that is absent from the current host, record a **REWRITE REVIEW** entry with the TA name, the sourcetype literal, and the note "awaiting TA installation confirmation." Do not rename or delete the stanza. If the TA identity cannot be determined, treat the sourcetype as unsupported and apply the rename-or-**REWRITE REVIEW** rule in step 3.

### Pipeline Ordering And Data Movement

1. Filter rows before calculations: move independent `search`/`where` predicates ahead of `eval`, `lookup`, `rex`, `foreach`, aggregation, and enrichment. Keep predicates after the command that creates the field they require.
2. Reduce columns early with `fields required_field ...` and optionally `fields - _raw` when the downstream field dependency set is complete. Never remove `_raw` before a later extraction or command needs it, and do not add an early `fields` command when transforming commands already enforce a smaller schema.
3. Keep non-streaming and transforming commands such as `stats`, `chart`, `timechart`, `sort`, `top`, `append`, and explicit `table` as late as semantics allow. Once processing centralizes on the search head, later filters cannot recover indexer parallelism.
4. Review `join`, `append`, `appendcols`, `transaction`, and subsearches for extra indexer trips, truncation limits, and timeout risk. Prefer a single OR base plus conditional `stats` when it is semantically equivalent; never rewrite correlation mechanically when cardinality or event pairing would change.
5. Use `tstats` only for indexed fields, metrics, or valid data-model datasets. Every `tstats ... FROM datamodel=...` search must use this app's acceleration macro (`scd_summariesonly` or a reviewed per-data-model variant), never a hardcoded `summariesonly=true` or `summariesonly=false`. Shipped macros default to `summariesonly=false allow_old_summaries=false` so unaccelerated deployments remain correct. Flag one shared toggle spanning unrelated data models when customers may need independent acceleration settings; do not apply an acceleration macro to index-metadata `tstats` searches that have no data model.
6. Combine adjacent compatible calculations, avoid repeated sorting and aggregation, and limit result cardinality only when doing so preserves the operational answer.
7. Use Job Inspector or equivalent telemetry for material rewrites when representative data exists. Compare scan count, event count, bucket elimination, result count/schema, runtime, remote search, and search-head versus indexer work. Parser success alone is not performance evidence.

### Entity Reduction Without Dedup

1. Do not use or recommend the `dedup` command in catalog searches, including nested subsearches. The canonical catalog must contain zero executable `dedup` stages.
2. Define the intended entity grain and selection rule explicitly, then reduce with `stats` or accelerated `tstats`. Use `latest(field)` with `latest(_time)` for current state, `earliest(field)` for first observation, `values(field)` when all distinct values are meaningful, or an explicit aggregate such as `max`, `min`, `sum`, or `dc` for ranked and counted results.
3. When several fields must come from the same winning event, use an explicit ordering key and a selection pattern that preserves row association; do not combine independent `latest(field)` values when they could originate from different events. If association cannot be proven, leave the search unchanged and record **REWRITE REVIEW**.
4. Replace `sort ... | dedup entity` only after identifying whether the original intended latest, earliest, highest, lowest, or arbitrary selection. Never translate an arbitrary `dedup` mechanically into `stats values(*)` or `stats latest(*)`.
5. Remove premature `table` or `fields` stages before entity reduction. Carry only the fields required by the grouping and aggregates, then apply the final presentation projection after `stats`.

### Fillnull Evidence Gate

1. Remove `fillnull` by default. Retain it only when a null value must become an explicit category before a downstream `stats`, `chart`, `timechart`, or equivalent aggregation whose `BY`/split field would otherwise drop that row.
2. A display fallback, arithmetic default, join repair, or broad `fillnull value=...` is not sufficient justification. Use targeted `eval field=coalesce(field, value)` at the point the value is required, or let visualization/rendering fallbacks handle missing display values.
3. Every retained `fillnull` must name its fields, appear before the aggregation that requires the category, and have metadata explaining which grouping would otherwise lose null rows. Do not retain fieldless `fillnull` or use it after the final transform.

### Representative Example Consolidation

1. Treat searches that differ only by substituting an entity field, object type, component value, or equivalent user-customizable dimension as one example family, not distinct catalog value.
2. Keep the clearest representative with the strongest metadata and most reusable SPL. In its `related_info`, state which base constraint or grouping field users can customize for sibling entities.
3. Before removing sibling examples, verify dashboard, drilldown, saved-search, Searchbase, and post-process references and confirm that no unique source, sourcetype, data model, macro, output contract, operational intent, or visualization behavior would be lost.
4. Apply this review especially to newly added `dc_` and `dc_networking_` stanzas. Do not retain repetitive inventory/list searches merely because each substitutes a different ACI object field or component.

### Deterministic Top-N Results

1. Review every `head`, `tail`, and unranked result limit. A `head` or `tail` before the first aggregation in its pipeline truncates the population being measured and silently produces incomplete counts, breakdowns, or trends; classify this as a correctness defect unless the bounded sample is the explicitly documented question. After an unordered transform such as `stats` or `tstats`, a bare limit instead retains an arbitrary result subset and is a deterministic-ranking defect.
2. Define the intended result grain and ranking field before limiting rows. For entity-detail searches, first collapse repeated observations to one row per stable entity using accelerated `tstats latest(...) BY entity` where supported, or `stats latest(...) BY entity` when post-search aggregation is required.
3. Preserve a numeric ranking field such as `latest(_time) AS last_seen`, derive any fallback recency before projection, and use bounded `sort N - ranking_field` for deterministic top-N output. Prefer bounded `sort N` over `sort ... | head N`; remove the separate `head` when both express the same limit.
4. Do not replace raw-event detail with entity-level aggregation unless the operational question calls for one row per entity. When every event is independently meaningful, sort the events deterministically and retain the bounded result limit.
5. Push cardinality reduction into `tstats` or the earliest semantically valid transform. A final limit controls returned rows but does not reduce upstream scanning, grouping, or search-head work.

Treat these as evidence-driven optimization constraints, not permission to alter results. Compare bounded original and rewritten searches; preserve output fields, grouping, time semantics, null handling, and cardinality unless the catalog review explicitly intends a behavioral change.

## Macro And Dispatch Ownership

Apply this policy to every search harvested or added to `searchbase.conf`, regardless of source app:

1. Inventory the source search's index macros, acceleration macros, structural macros, eventtypes, lookups, data models, and custom commands.
2. Prefer an equivalent macro already defined in this app's `default/macros.conf`. In this repository, use domain macros such as `index_catalyst` and `index_dc`, and use `scd_summariesonly` for `tstats` acceleration behavior.
3. Preserve all source constraints when adapting a macro. If no local index macro covers a real data domain, add one with a precise sourcetype-domain description instead of retaining a foreign index macro or hardcoding an index.
4. Determine `dispatch_context` from verified knowledge-object ownership and export visibility; there is no directional default. Inventory every referenced macro, lookup, eventtype, data model, and custom command, then inspect the installed owner's effective object plus `metadata/default.meta`, `metadata/local.meta`, or `btool` ACL/export output.
5. Use `splunk-cisco-dashboards` only when every dependency is defined locally or genuinely exported into that namespace. If any required object is source-app-local or explicitly `export = none`, dispatch in that owning app. A source app's application-level `export = system` or an object-specific system export is positive evidence that foreign dispatch is unnecessary.
6. Record the exact owner and export evidence for each nonlocal dependency. Do not infer visibility from an app name, harvest origin, absence from this app's `default/`, or a second search that happens to use the same object.
7. Execute representative bounded searches in the selected context. Never copy a large source macro or data model into this app solely to force a preferred dispatch context.

## Stanza And Consumer Contract Integrity

1. Before stanza-level review, scan continuation-aware raw `.conf` text for duplicate keys. Splunk keeps the last effective value; remove dead duplicates only after verifying the surviving value against the search and its consumer. A key-shaped line inside a continued multiline `search` is SPL, not a duplicate metadata key.
2. Treat `searchbase.conf.spec` and audit documents as secondary references that can drift. Verify required fields, enum behavior, fallbacks, filters, and join keys against the current parsing service, picker, visualization, and drilldown consumer code; report and fix documentation drift separately.
3. Verify every `drilldown_search_name` with the exact key behavior used by the active consumer. Then verify semantic fit: the button promise, target SPL grain, fields, visualization, and remediation must match. A resolvable but wrong target is a defect.
4. Record consumer sentinels outside catalog-quality scope when they make features unusable. In this repository, the Dashboard Builder selector currently filters for `search_type == "display"`; audit whether the field is populated before relying on that picker, but do not mass-add it without confirming all consumers and intended visibility semantics.
5. Review `category`, `sub_category`, and `tags` as controlled vocabularies. Replace authoring/reconciliation provenance with operational domains, reusing established sibling values. Merge tags only when near-total co-occurrence and semantic synonymy are both proven; correlation alone is insufficient.

## Safety Rules

- Scope the first pass by an explicit stanza prefix, dispatch context, source app, or file.
- Never restart Splunk.
- Before live execution, reject searches containing `collect`, `delete`, `outputlookup`, `outputcsv`, `sendemail`, `fit`, `apply`, or another write/side-effect command.
- Use read-only, bounded time ranges and result counts for live validation.
- Preserve macros, eventtypes, source constraints, data models, acceleration settings, and meaningful wildcard patterns unless evidence proves they are wrong.
- Parse XML with `defusedxml`, reject DTDs/entities/external references, and cap input size.
- Do not add credentials, tokens, certificates, or private keys to source or commands.
- Before invoking a repository script merely to inspect `--help` or another apparent flag, read its entry point and confirm argument parsing gates all write behavior. Some scripts execute writes at import or startup regardless of unknown arguments.

## Audit Procedure

When multiple rules apply to a single stanza, apply them in this order: (1) safety rules, (2) independent value gate, (3) reference verification, (4) performance optimization, (5) projection review, (6) metadata review. Record conflicts between rules as **REWRITE REVIEW**.

### Example-Driven Scope Expansion

Treat a user-provided stanza, SPL fragment, or anti-pattern as an example of the requested defect class unless the user explicitly limits the scope to that occurrence. Before editing the example:

1. Search the complete canonical `searchbase.conf` with the stanza parser, not text matching alone, and inventory every search containing the same command or semantic defect.
2. Classify every occurrence by intent and neighboring commands. Apply clear, semantics-preserving remediations catalog-wide; keep ambiguous cases unchanged and place them in the decision ledger with the evidence needed to resolve them.
3. Fix the owning generator or curation script when the pattern is generated, then regenerate the canonical catalog instead of allowing the defect to return.
4. Report the total occurrences reviewed, counts by remediation class, searches changed, searches retained with justification, and unresolved decisions. Never report the example as complete while unreviewed occurrences of the same defect class remain.

When the user explicitly states that the prompt or skill has been updated, run the full-catalog audit against the complete canonical `searchbase.conf` before responding to any other request in that session. Re-evaluate all existing stanzas against every changed or newly added standard, apply authorized clear fixes, and report residual violations or decision-ledger items. A skill update is incomplete until the full-catalog rerun and its validation gates finish.

1. Parse the catalog with the repository formatter/parser. Do not use ad hoc line splitting for multiline SPL. If a stanza has an empty or absent `search` field, classify it as **REVIEW DELETE**, record it in the decision ledger with stanza ID and a note that no SPL is present, and do not apply optimization or projection rules to it.
2. Run continuation-aware duplicate-key detection, then inventory the scoped stanzas: IDs, names, SPL, metadata, data models, macros, verified sourcetypes, visualization roles, consumer contracts, and drilldown references.
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
19. After every automated edit pass, scan all metadata values for literal edit instructions or parenthetical meta text such as `TODO`, `FIXME`, `remove both bullets`, `replace with ...`, or `(remove - no target exists)`. Apply the intended edit or restore a real value; never ship the instruction itself.

## Validation Gates

- Focused tests for the harvester and cleanup logic pass.
- No stanza contains a duplicate effective key; each removed duplicate's surviving value has been semantically verified.
- Scoped catalog has zero unresolved dashboard tokens.
- Scoped catalog has zero exact bare-star predicates.
- Scoped catalog has zero exact canonical-SPL duplicate groups.
- No raw-event search starts with `eventtype=`; each verified eventtype base is expressed with an app-owned index macro, explicit sourcetype, and preserved meaningful predicates.
- No search contains `table *`. Every nonterminal explicit `table` has been safely replaced/moved or has a documented **REWRITE REVIEW** record.
- Every raw-event search has the narrowest verified index, sourcetype/source/host, field, and time constraints available without changing its operational meaning.
- Independent filters run before calculations and non-streaming commands as far as field dependencies allow; retained early transforms and expensive correlation commands have documented justification.
- Every retained `head`, `tail`, or result limit has a documented deterministic ordering or a verified order-independent purpose; top-N searches reduce to the intended grain before using a bounded `sort N` where semantically equivalent.
- No `head` or `tail` truncates the population before a downstream aggregation unless bounded sampling is the explicit documented behavior.
- No executable search or nested subsearch contains `dedup`; every entity reduction states its grain and selection aggregate explicitly.
- Every retained `fillnull` is field-targeted, precedes a grouping that requires an explicit null category, and has metadata documenting that dependency; all other null handling uses targeted `coalesce` or rendering fallback.
- Repetitive field-, component-, or object-type variants have one reviewed representative unless a verified reference or distinct operational contract requires retention.
- No terminal projection provably repeats the complete output of its immediately preceding transform; all retained ambiguous projections remain unchanged or have a review record.
- Every literal sourcetype has installed-app, `btool`, official-documentation, generator, or observed-event evidence; unsupported literals remain in **REWRITE REVIEW** rather than being guessed.
- Every data-model `tstats` uses a reviewed acceleration macro and no search hardcodes `summariesonly=true`; unrelated data models have independently tunable macros when customer acceleration states can differ.
- Harvested searches use local index and acceleration macros wherever equivalent abstractions exist.
- Every dispatch context has recorded dependency ownership and export evidence; source-app-local dependencies dispatch in their owning app, while system-exported dependencies may dispatch locally.
- Every drilldown resolves using the active consumer's key behavior and has verified semantic fit with its button label and target output.
- Consumer-code contracts and `searchbase.conf.spec` have been compared for fields relied on by this audit; discrepancies and feature-blocking sentinels such as absent `search_type` values are reported.
- Categories, subcategories, and tags use operational controlled vocabulary; provenance labels and unproven synonym merges are absent.
- Every bare keyword or phrase filter has a recorded field-first review: verified structured rewrite, documented raw-term justification, or unresolved **REWRITE REVIEW** decision.
- Every harvested search has an independent-value classification. Every omission, merge, or deletion has verified reference status and either direct user authorization, inclusion in an explicitly authorized clear defect class, or a recorded decision for an unresolved candidate.
- Raw base searches are retained only when independently valuable; resolved child searches preserve any unique source, sourcetype, macro, and data-model coverage.
- All source data models remain represented unless a reviewed duplicate was removed.
- Every changed `search` has a documented review of `description`, `explanation`, `solution`, and `related_info`; all four fields remain accurate for the final SPL, even when the review requires no text changes.
- Every non-final physical line of every multiline `search` ends with `\\`; run a catalog-wide continuation scan after writing, including formatting-only changes.
- Formatter check and `git diff --check` pass.
- Diagnostics for changed scripts and catalog files are clean.
- No metadata value contains an unapplied edit instruction, TODO/FIXME marker, or parenthetical removal/replacement note.
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
