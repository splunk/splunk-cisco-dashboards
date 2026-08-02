#!/usr/bin/env python3
"""Clean and exactly deduplicate the DC Networking Searchbase catalog slice."""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

try:
    from scripts.format_searchbase_conf import (
        SOURCE,
        format_search,
        format_stanza,
        parse_stanzas,
    )
    from scripts.harvest_dc_networking_app_to_searchbase import (
        DEFAULT_APP,
        DEFAULT_MANIFEST,
        DM,
        SOURCE_APP,
        canonical_spl,
        effective_views,
        extract_dashboard,
        load_formatter,
        parse_savedsearches,
        persisted_canonical_spl,
        has_match_all_predicate,
        remove_match_all_predicates,
    )
except ModuleNotFoundError:
    from format_searchbase_conf import SOURCE, format_search, format_stanza, parse_stanzas
    from harvest_dc_networking_app_to_searchbase import (
        DEFAULT_APP,
        DEFAULT_MANIFEST,
        DM,
        SOURCE_APP,
        canonical_spl,
        effective_views,
        extract_dashboard,
        load_formatter,
        parse_savedsearches,
        persisted_canonical_spl,
        has_match_all_predicate,
        remove_match_all_predicates,
    )


PREFERRED_GROUPS = {
    frozenset(
        {
            "dc_networking_system_faults_faults_by_cause_detail",
            "dc_networking_system_faults_faults_by_domain_detail",
            "dc_networking_system_faults_faults_by_node_detail",
            "dc_networking_system_faults_faults_by_rule_detail",
            "dc_networking_system_faults_faults_by_severity_detail",
            "dc_networking_system_faults_faults_by_tenant_detail",
            "dc_networking_system_faults_faults_by_type_detail",
        }
    ): "dc_networking_system_faults_faults_by_severity_detail",
    frozenset(
        {
            "dc_networking_events_events_by_cause_detail",
            "dc_networking_events_events_by_severity_detail",
            "dc_networking_events_events_by_user_detail",
        }
    ): "dc_networking_events_events_by_severity_detail",
    frozenset(
        {
            "dc_networking_fabric_details_affected_interfaces",
            "dc_networking_multi_pod_affected_interfaces",
        }
    ): "dc_networking_fabric_details_affected_interfaces",
    frozenset(
        {
            "dc_networking_faults_transition_acknowledged_faults_detail",
            "dc_networking_all_faults_detail_fault_detail_apic_site",
        }
    ): "dc_networking_all_faults_detail_fault_detail_apic_site",
    frozenset(
        {
            "dc_networking_orchestrator_overview_schema_count",
            "dc_networking_schemas_no_of_schemas_associated_with_orchestrator",
        }
    ): "dc_networking_orchestrator_overview_schema_count",
    frozenset(
        {
            "dc_networking_sites",
            "dc_networking_tenants_apic_site_directory",
        }
    ): "dc_networking_tenants_apic_site_directory",
    frozenset(
        {
            "dc_networking_tenant_details_client_end_point_details_for_tenant",
            "dc_networking_vmware_client_end_point_details",
        }
    ): "dc_networking_vmware_client_end_point_details",
}

SURVIVOR_METADATA = {
    "dc_networking_system_faults_faults_by_severity_detail": {
        "search_name": "DC Networking - System Fault Detail",
        "description": "<p>Reports current Cisco DC Networking system fault details with node, severity, cause, domain, rule, type, and recommended action.</p>",
    },
    "dc_networking_events_events_by_severity_detail": {
        "search_name": "DC Networking - Event Detail",
        "description": "<p>Reports the latest Cisco DC Networking event details with cause, severity, user, distinguished name, and APIC host.</p>",
    },
    "dc_networking_all_faults_detail_fault_detail_apic_site": {
        "search_name": "DC Networking - Fault Detail",
        "description": "<p>Reports Cisco DC Networking fault timing, acknowledgement, severity, cause, lifecycle, domain, and tenant details.</p>",
    },
}


def curate_text(text: str) -> tuple[str, dict[str, object]]:
    stanzas = parse_stanzas(text)
    if len({name for name, _ in stanzas}) != len(stanzas):
        raise ValueError("duplicate stanza IDs prevent deterministic curation")

    fields_by_name = {name: fields for name, fields in stanzas}
    target = {
        name: fields
        for name, fields in stanzas
        if fields.get("dispatch_context") == SOURCE_APP
    }
    groups: dict[str, list[str]] = defaultdict(list)
    cleaned_searches: dict[str, str] = {}
    for name, fields in target.items():
        cleaned = remove_match_all_predicates(fields.get("search", "").replace("\\\n", " "))
        formatted, _ = format_search(cleaned)
        if not formatted:
            raise ValueError(f"cleanup produced an empty search: {name}")
        cleaned_searches[name] = formatted
        groups[canonical_spl(formatted)].append(name)

    dropped: set[str] = set()
    for names in groups.values():
        if len(names) == 1:
            continue
        group = frozenset(names)
        preferred = PREFERRED_GROUPS.get(group)
        if preferred is None:
            raise ValueError(f"unreviewed exact duplicate group: {sorted(group)}")
        dropped.update(group - {preferred})

    updated_fields: dict[str, dict[str, str]] = {}
    for name, fields in target.items():
        if name in dropped:
            continue
        updated = {**fields, "search": cleaned_searches[name]}
        updated.update(SURVIVOR_METADATA.get(name, {}))
        updated_fields[name] = updated

    header_matches = list(re.finditer(r"(?m)^\[([a-z0-9_]+)\]\n", text))
    if not header_matches:
        raise ValueError("no Searchbase stanzas found")
    output = [text[: header_matches[0].start()]]
    for index, match in enumerate(header_matches):
        name = match.group(1)
        end = (
            header_matches[index + 1].start()
            if index + 1 < len(header_matches)
            else len(text)
        )
        original_block = text[match.start() : end]
        if name not in target:
            output.append(original_block)
        elif name not in dropped:
            output.append(format_stanza(name, updated_fields[name])[0] + "\n\n")

    curated = "".join(output).rstrip() + "\n"
    retained = list(updated_fields.values())
    data_models = sorted({model for fields in retained for model in DM.findall(fields["search"])})
    report: dict[str, object] = {
        "context": SOURCE_APP,
        "input_stanzas": len(target),
        "retained_stanzas": len(retained),
        "removed_exact_duplicates": len(dropped),
        "removed_stanza_ids": sorted(dropped),
        "match_all_predicates_remaining": sum(
            has_match_all_predicate(fields["search"]) for fields in retained
        ),
        "data_model_searches": sum(bool(DM.search(fields["search"])) for fields in retained),
        "data_models": data_models,
    }
    return curated, report


def refresh_manifest(
    manifest_path: Path, app_root: Path, report: dict[str, object]
) -> None:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    previous_curation = manifest.get("catalog_curation")
    catalog_curation = report
    if (
        isinstance(previous_curation, dict)
        and previous_curation.get("removed_exact_duplicates", 0)
        > report.get("removed_exact_duplicates", 0)
    ):
        catalog_curation = {
            **previous_curation,
            "match_all_predicates_remaining": report[
                "match_all_predicates_remaining"
            ],
            "data_model_searches": report["data_model_searches"],
            "data_models": report["data_models"],
            "last_run": report,
        }
    savedsearches: dict[str, str] = {}
    for layer in ("default", "local"):
        savedsearches.update(parse_savedsearches(app_root / layer / "savedsearches.conf"))

    formatter = load_formatter()
    source_searches = {}
    occurrences = 0
    for view in effective_views(app_root):
        _, entries, _ = extract_dashboard(view, savedsearches)
        occurrences += len(entries)
        for entry in entries:
            source_searches.setdefault(
                persisted_canonical_spl(entry.search, formatter), entry
            )

    manifest.update(
        {
            "unique_dashboard_searches": len(source_searches),
            "duplicate_dashboard_occurrences": occurrences - len(source_searches),
            "data_model_candidates": sum(
                bool(entry.datamodels) for entry in source_searches.values()
            ),
            "data_models": sorted(
                {model for entry in source_searches.values() for model in entry.datamodels}
            ),
            "catalog_curation": catalog_curation,
        }
    )
    manifest.pop("already_in_searchbase", None)
    manifest.pop("harvest_candidates", None)
    manifest.pop("replaced_stanzas", None)
    manifest.pop("added_stanzas", None)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--app-root", type=Path, default=DEFAULT_APP)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()

    original = args.source.read_text(encoding="utf-8")
    curated, report = curate_text(original)
    report["changed"] = curated != original
    print(json.dumps(report, indent=2))
    if args.write and curated != original:
        args.source.write_text(curated, encoding="utf-8")
    if args.write:
        refresh_manifest(args.manifest, args.app_root, report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())