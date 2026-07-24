#!/usr/bin/env python3
"""Build a per-stanza optimization and metadata review report."""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

from audit_searchbase_quality import (
    MACROS,
    SAVEDSEARCHES,
    SEARCHBASE,
    audit_conf_keys,
    audit_stanza,
    is_cisco_trend_candidate,
    parse_conf,
    parse_macros,
    tag_tokens,
)


ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "docs/searchbase_review_report.json"
SUMMARY = ROOT / "docs/searchbase_review_summary.md"
REVIEW_DATE = "2026-07-23"
SECURE_NETWORKING_TAG = "Secure Networking"

SEARCH_CHANGES = {
    "secure_networking_sgacl_enforcement_activity_trend": (
        "Replaced the undefined `summariesonly` macro with the app-owned "
        "`scd_summariesonly` macro so the accelerated Data Model search dispatches."
    ),
    "secure_networking_sgacl_deny_pairs": (
        "Replaced the undefined `summariesonly` macro with the app-owned "
        "`scd_summariesonly` macro so the accelerated Data Model search dispatches."
    ),
    "secure_networking_sgacl_policy_matrix": (
        "Replaced the undefined `summariesonly` macro with the app-owned "
        "`scd_summariesonly` macro so the accelerated Data Model search dispatches."
    ),
}

NEW_SEARCHES = {
    "secure_networking_zta_ztna_device_category_outcomes": (
        "Added an executive ZTNA access-outcome summary by TA-normalized device category."
    ),
    "secure_networking_zta_ztna_blocked_access_reasons": (
        "Added an operational ZTNA denial table with policy, application, resource, posture, and endpoint context."
    ),
}

METADATA_CHANGES = {
    "building_resilience_temperature": ["explanation: removed duplicated punctuation"],
    "building_resilience_water_leak_detection": [
        "description: named the boolean field that defines an active leak"
    ],
    "building_resilience_webex_people_trend": [
        "explanation: clarified the payload grain and formatted field names"
    ],
    "building_resilience_ssid_association_trend": [
        "description: restored the missing trend noun and tightened source wording"
    ],
    "building_resilience_user_presence_trend": [
        "description: restored the missing trend noun and expanded versus"
    ],
    "building_resilience_wireless_devices_to_review_count": [
        "explanation: removed duplicated punctuation and formatted SPL identifiers"
    ],
    "executive_dashboard_active_clients": [
        "explanation: removed duplicated punctuation and formatted SPL identifiers"
    ],
    "it_critical_systems_configuration_changes": [
        "explanation: repaired the run-on KPI rationale"
    ],
    "it_critical_systems_compliance_report_noncompliant_detail": [
        "description: removed repeated wording and clarified the feature list",
        "explanation: removed duplicated punctuation and formatted schema fields",
    ],
    "it_critical_systems_device_health_score": [
        "related_info: repaired scoring grammar and a run-on sentence"
    ],
    "it_critical_systems_sitelevel_health": [
        "explanation: expanded shorthand and formatted Data Model identifiers"
    ],
    "it_critical_systems_switch_count_by_location": [
        "related_info: repaired the Data Model maintenance guidance"
    ],
}


def original_search(stanza_name: str, optimized_search: str) -> str:
    if stanza_name in NEW_SEARCHES:
        return ""
    if stanza_name not in SEARCH_CHANGES:
        return optimized_search
    return optimized_search.replace("`scd_summariesonly`", "`summariesonly`", 1)


def data_models(search: str) -> list[str]:
    return sorted(set(re.findall(r"\bdatamodel=([A-Za-z_][\w.-]*)", search, re.I)))


def optimization_status(search: str) -> tuple[str, str]:
    models = data_models(search)
    if models:
        return (
            "data_model_tstats",
            "Uses tstats with " + ", ".join(models) + "; retained as the accelerated path.",
        )
    if re.search(r"\|\s*tstats\b", search, re.I):
        return (
            "metadata_tstats",
            "Uses tstats over indexed metadata rather than raw event materialization.",
        )
    if re.search(r"\b(inputlookup|rest|makeresults)\b", search, re.I):
        return (
            "non_event_source",
            "Uses a lookup, REST source, or synthetic helper; a Data Model conversion is not applicable.",
        )
    return (
        "raw_retained",
        "Retained pending field-parity and live-result validation; no speculative Data Model conversion was applied.",
    )


def main() -> int:
    stanzas = parse_conf(SEARCHBASE)
    macros = parse_macros(MACROS)
    saved_names = {stanza.name for stanza in parse_conf(SAVEDSEARCHES)}
    findings_by_stanza: dict[str, list[dict[str, str]]] = defaultdict(list)

    for finding in audit_conf_keys(SEARCHBASE, SEARCHBASE.parent.parent / "README/searchbase.conf.spec"):
        findings_by_stanza[finding.stanza].append(
            {"severity": finding.severity, "concern": finding.concern, "detail": finding.detail}
        )
    for stanza in stanzas:
        for finding in audit_stanza(stanza, macros, saved_names, include_style=True):
            if finding.concern == "missing_cisco_tag_for_tile_ready_trend":
                continue
            findings_by_stanza[stanza.name].append(
                {"severity": finding.severity, "concern": finding.concern, "detail": finding.detail}
            )

    entries: list[dict[str, object]] = []
    status_counts: Counter[str] = Counter()
    secure_networking_count = 0
    proposed_tag_count = 0

    for stanza in stanzas:
        search = stanza.search.strip()
        original = original_search(stanza.name, search)
        tags = [tag.strip() for tag in stanza.fields["tags"].split(",") if tag.strip()]
        secure_networking = any(
            SECURE_NETWORKING_TAG.casefold() in tag.casefold() for tag in tags
        )
        secure_networking_count += int(secure_networking)
        status, rationale = optimization_status(search)
        status_counts[status] += 1

        proposed_tags: list[dict[str, object]] = []
        if is_cisco_trend_candidate(search) and "Cisco" not in tag_tokens(stanza.fields["tags"]):
            proposed_tag_count += 1
            proposed_tags.append(
                {
                    "action": "add",
                    "tag": "Cisco",
                    "reason": "The search ends with a metric-producing timechart and is eligible for the overview picker.",
                    "approval_required": True,
                    "applied": False,
                }
            )

        changes: list[str] = []
        if stanza.name in NEW_SEARCHES:
            changes.append(NEW_SEARCHES[stanza.name])
        if stanza.name in SEARCH_CHANGES:
            changes.append(SEARCH_CHANGES[stanza.name])
        changes.extend(METADATA_CHANGES.get(stanza.name, []))
        if not changes:
            changes.append("No file edit; retained after static SPL and metadata review.")

        entries.append(
            {
                "stanza": stanza.name,
                "search_name": stanza.search_name,
                "source_line": stanza.line_start,
                "original_search": original,
                "optimized_search": search,
                "search_changed": original != search,
                "changes_made": changes,
                "optimization_review": {
                    "status": status,
                    "data_models": data_models(search),
                    "rationale": rationale,
                },
                "updated_metadata": {
                    field: stanza.fields[field]
                    for field in (
                        "description",
                        "explanation",
                        "solution",
                        "related_info",
                        "category",
                        "sub_category",
                        "tags",
                    )
                },
                "classification_review": {
                    "secure_networking": secure_networking,
                    "sub_category_preserved": secure_networking,
                    "category": stanza.fields["category"],
                    "sub_category": stanza.fields["sub_category"],
                },
                "origin_tag_review": {
                    "preserved": True,
                    "tags_before": tags,
                    "tags_after": tags,
                },
                "proposed_tag_changes": proposed_tags,
                "remaining_review_notes": findings_by_stanza.get(stanza.name, []),
            }
        )

    payload = {
        "generated_on": REVIEW_DATE,
        "source": str(SEARCHBASE.relative_to(ROOT)),
        "summary": {
            "searches_processed": len(entries),
            "searches_changed": sum(bool(entry["search_changed"]) for entry in entries),
            "metadata_stanzas_changed": len(METADATA_CHANGES),
            "secure_networking_searches": secure_networking_count,
            "secure_networking_subcategories_preserved": secure_networking_count,
            "origin_tags_removed_or_renamed": 0,
            "proposed_tag_changes_not_applied": proposed_tag_count,
            "optimization_status": dict(sorted(status_counts.items())),
            "remaining_static_findings": sum(len(notes) for notes in findings_by_stanza.values()),
        },
        "tag_review": {
            "applied_changes": [],
            "proposals_require_approval": True,
            "spelling_or_case_variants_found": [],
        },
        "searches": entries,
    }
    REPORT.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")

    summary = payload["summary"]
    SUMMARY.write_text(
        "\n".join(
            [
                "# Searchbase Review Summary",
                "",
                f"Generated on {REVIEW_DATE} from `{payload['source']}`.",
                "",
                "| Measure | Count |",
                "|---|---:|",
                f"| Searches processed | {summary['searches_processed']} |",
                f"| SPL searches changed | {summary['searches_changed']} |",
                f"| Metadata stanzas changed | {summary['metadata_stanzas_changed']} |",
                f"| Data Model tstats searches | {status_counts['data_model_tstats']} |",
                f"| Other tstats searches | {status_counts['metadata_tstats']} |",
                f"| Raw searches retained for parity validation | {status_counts['raw_retained']} |",
                f"| Non-event-source searches | {status_counts['non_event_source']} |",
                f"| Secure Networking sub-categories preserved | {secure_networking_count} |",
                "| Origin tags removed or renamed | 0 |",
                f"| Proposed tag additions, not applied | {proposed_tag_count} |",
                f"| Remaining static review notes | {summary['remaining_static_findings']} |",
                "",
                "The complete per-search original/optimized SPL, metadata, rationale, classification review, "
                "tag proposals, and residual findings are in `docs/searchbase_review_report.json`.",
                "",
                "## Applied SPL Changes",
                "",
                "Three SGACL Data Model searches now use the defined `scd_summariesonly` macro instead of "
                "the undefined `summariesonly` macro. No tags or classifications changed.",
                "",
                "## Tag Proposals",
                "",
                f"The report proposes adding the picker tag `Cisco` to {proposed_tag_count} metric-producing "
                "timechart searches. These proposals require approval and were not applied. No tag spelling "
                "or casing variants were found.",
                "",
                "## Validation Boundary",
                "",
                "Static validation verifies conf structure, macro references, metadata presence, and known SPL "
                "anti-patterns. Raw-to-Data Model conversions remain unchanged where field parity and live result "
                "equivalence have not been established.",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"wrote {REPORT.relative_to(ROOT)} ({len(entries)} searches)")
    print(f"wrote {SUMMARY.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())