---
name: audit-searchbase-catalog
description: 'Production-audit and curate Searchbase catalogs and harvested Splunk dashboard searches. Use to remove dashboard tokens and match-all residue, consolidate duplicate or similar SPL, preserve data models, improve metadata, and validate searches safely in Splunk.'
argument-hint: '[searchbase.conf path or dispatch context]'
---

# Audit Searchbase Catalog

Produce a high-fidelity customer-facing catalog, not a literal dashboard export. Treat dashboard XML as provenance. Prefer validated production SPL when the catalog already contains deliberate runtime repairs.

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
3. Locate the owning harvester or generator. Fix recurring defects there before rewriting generated output.
4. Remove unresolved dashboard tokens and exact match-all predicates such as `field=*`, `field="*"`, `field='*'`, or token-derived `field IN $token$`.
5. Remove now-empty `search`/`where` stages and dangling Boolean operators while retaining neighboring static predicates.
6. Preserve meaningful patterns such as `node="*leaf*"`, `dn="*/sys/health"`, and intentional source wildcards.
7. Canonicalize SPL with the repository formatter and remove exact duplicates. Before deletion, verify references and select the clearest, most reusable metadata.
8. Generate near-duplicate candidates with normalized TF-IDF cosine similarity, a length penalty, and a minimum shared-term threshold. Searchbase's reference formula is:

   $$s(a,b)=\cos(a,b)\left(\frac{\min(|a|,|b|)}{\max(|a|,|b|)}\right)^{0.5}$$

9. Review every candidate semantically. Keep both searches when they differ by source/sourcetype, success/failure, severity, direction, aggregation, grouping, output fields, visualization, drilldown role, or operational intent. Similarity scores nominate candidates; they never authorize deletion.
10. Improve generic or dashboard-bound names and prose. Metadata must describe the independent search's actual output and remediation use.
11. Regenerate provenance/manifest metrics, distinguishing source dashboard searches from retained curated catalog searches.

## Validation Gates

- Focused tests for the harvester and cleanup logic pass.
- Scoped catalog has zero unresolved dashboard tokens.
- Scoped catalog has zero exact bare-star predicates.
- Scoped catalog has zero exact canonical-SPL duplicate groups.
- All source data models remain represented unless a reviewed duplicate was removed.
- Formatter check and `git diff --check` pass.
- Diagnostics for changed scripts and catalog files are clean.
- Representative searches across macros, eventtypes, data models, syslog, lookups, subsearches, and joins execute read-only without SPL errors.
- Empty results are classified separately from parser, schema, macro, permission, or dispatch errors.

## Reporting

Report the scoped count before and after, exact duplicates removed, near-duplicate decisions, wildcard residue, data-model count/models, live-validation outcomes, and any unrelated pre-existing failures. Explain why high-scoring searches were retained when their operational intent differs.