#!/usr/bin/env python3
"""Convert raw cisco:dnac/catalyst:issue searches to Cisco_Catalyst_App tstats.

Wave 4: Cisco_Catalyst_Active_Issue_Events dataset.
Skips site enrichment, composite append/join, non-DM fields, and multi-sourcetype composites.
"""

from __future__ import annotations

import argparse
import importlib.util
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = REPO / (
    "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf"
)
FORMAT_SCRIPT = REPO / "scripts/format_searchbase_conf.py"

AI = "Cisco_Catalyst_Dataset.Cisco_Catalyst_Active_Issue_Events"
DM_FROM = f"FROM datamodel=Cisco_Catalyst_App WHERE nodename={AI}"
DM_SUMMARIES_MACRO = "summariesonly"
DM_TSTATS_DEFAULT_SPAN = "30m"

RAW_TO_DM: dict[str, str] = {
    "IssueID": "active_issue_id",
    "IssueCount": "active_issue_count",
    "IssueStatus": "active_issue_status",
    "IssueName": "active_issue_name",
    "IssueSpecificPriority": "active_issue_specific_priority",
    "IssueSpecificSeverity": "active_issue_specific_severity",
    "IssueSpecificCategory": "active_issue_specific_category",
    "IssueSpecificName": "active_issue_specific_name",
    "IssueSpecificSummary": "active_issue_specific_summary",
    "IssueSpecificTimestamp": "active_issue_specific_timestamp",
    "DeviceName": "active_issue_device_name",
    "DeviceIpAddress": "active_issue_device_ip_address",
    "DeviceMACAddress": "active_issue_device_mac_address",
    "DeviceFamily": "active_issue_device_family",
    "DeviceRole": "active_issue_device_role",
}

RENAME_PARTS = [
    f"{AI}.{dm} as {raw}" for raw, dm in RAW_TO_DM.items()
]
RENAME_DIMS = "| rename " + ", ".join(RENAME_PARTS)

OPENER_RE = re.compile(
    r"`index_catalyst`\s+sourcetype(?:\s+IN\s*\(\s*cisco:dnac:issue\s*,\s*cisco:catalyst:issue\s*\)"
    r'|\s*=\s*"cisco:dnac:issue")',
    re.I,
)

NON_DM_MARKERS = (
    "SiteName",
    "SiteNameHierarchy",
    "dnac_site_normalize",
    "devicehealth",
    "IssueSpecificDescription",
    "IssueSpecificEntity",
    "IssuePriority",
    "IssueCount",
    "asset_inventory",
    "inputlookup",
    "| lookup",
)

OTHER_SOURCETYPE_RE = re.compile(
    r"sourcetype[^\\n]*(?:devicehealth|networkhealth|clienthealth|compliance|"
    r"cisco:dnac:client[^h]|cisco:catalyst:client[^h]|cisco:ios)",
    re.I,
)

TIMECHART_RE = re.compile(r"^\|\s*timechart\b", re.I)
STATS_DC_RE = re.compile(
    r"^stats\s+dc\(IssueID\)\s+as\s+(\"?[\w ]+\"?)(?:\s+by\s+(.+))?\s*$",
    re.I,
)
STATS_COUNT_BY_RE = re.compile(r"^stats\s+count\s+by\s+(.+?)\s*$", re.I)
ENTERPRISE_EVAL_RE = re.compile(
    r"eval\s+issue_id\s*=\s*coalesce\(IssueID",
    re.I,
)
ISSUE_GROUP_EVAL_RE = re.compile(
    r"eval\s+issue_group\s*=\s*case\(match\(IssueName",
    re.I,
)


def load_formatter():
    spec = importlib.util.spec_from_file_location("format_searchbase_conf", FORMAT_SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def parse_stanzas(text: str) -> list[tuple[str, dict[str, str]]]:
    return load_formatter().parse_stanzas(text)


def unfold_search(search: str) -> list[str]:
    stages: list[str] = []
    buf = ""
    for line in search.split("\n"):
        line = line.strip()
        if not line:
            continue
        cont = line.endswith("\\")
        if cont:
            line = line[:-1].strip()
        if buf and line.startswith("|"):
            stages.append(buf.strip())
            buf = line
        else:
            buf = (buf + " " + line).strip() if buf else line
        if not cont:
            stages.append(buf.strip())
            buf = ""
    if buf.strip():
        stages.append(buf.strip())
    return stages


def fold_search(stages: list[str]) -> str:
    if not stages:
        return ""
    out: list[str] = []
    for i, stage in enumerate(stages):
        stage = stage.strip()
        if not stage.startswith("|"):
            stage = "| " + stage
        if i < len(stages) - 1:
            out.append(stage + "\\")
        else:
            out.append(stage)
    return "\n".join(out)


def map_by_clause(by_raw: str) -> str:
    parts = [p.strip() for p in by_raw.split(",")]
    mapped: list[str] = []
    for part in parts:
        if part == "_time":
            mapped.append("_time")
            continue
        if part in RAW_TO_DM:
            mapped.append(f"{AI}.{RAW_TO_DM[part]}")
        else:
            mapped.append(part)
    return ", ".join(mapped)


def extract_opener_filters(stage: str) -> tuple[str, list[str]]:
    m = OPENER_RE.search(stage)
    if not m:
        return stage, []
    after = stage[m.end() :].strip()
    filters: list[str] = []
    if after and not after.startswith("|"):
        pipe_idx = after.find(" | ")
        filter_blob = after[:pipe_idx] if pipe_idx >= 0 else after
        if pipe_idx >= 0:
            after = after[pipe_idx + 3 :].strip()
        else:
            after = ""
        for or_group in re.findall(r"\(([^)]+)\)", filter_blob):
            or_parts = re.findall(r'([A-Za-z]+)\s*(!=|=)\s*"([^"]+)"', or_group)
            if or_parts:
                mapped = " OR ".join(
                    f'{AI}.{RAW_TO_DM[field]}{op}"{val}"'
                    for field, op, val in or_parts
                    if field in RAW_TO_DM
                )
                if mapped:
                    filters.append(f"({mapped})")
        stripped = re.sub(r"\([^)]+\)", "", filter_blob).strip()
        for field, op, val in re.findall(r'([A-Za-z]+)\s*(!=|=)\s*"([^"]+)"', stripped):
            if field in RAW_TO_DM:
                filters.append(f'{AI}.{RAW_TO_DM[field]}{op}"{val}"')
    remainder = after.strip()
    if remainder and not remainder.startswith("|"):
        remainder = "| " + remainder
    return remainder, filters


def where_clause(where_filters: list[str]) -> str:
    where = " ".join(where_filters)
    return f" {where}" if where else ""


def tstats_span_from_timechart(tc_stage: str) -> str:
    span_m = re.search(r"span=(\S+)", tc_stage)
    if span_m:
        return span_m.group(1)
    if re.search(r"fixedrange=false", tc_stage, re.I):
        return "1h"
    return DM_TSTATS_DEFAULT_SPAN


def rename_for_fields(fields: set[str]) -> str | None:
    parts = [
        f"{AI}.{RAW_TO_DM[raw]} as {raw}"
        for raw in fields
        if raw in RAW_TO_DM
    ]
    if not parts:
        return None
    return "| rename " + ", ".join(parts)


def fields_referenced(stages: list[str]) -> set[str]:
    blob = " ".join(stages)
    return {raw for raw in RAW_TO_DM if re.search(rf"\b{raw}\b", blob)}


def build_tstats_dc(
    alias: str,
    where_filters: list[str],
    by_clause: str | None = None,
    agg: str = "dc",
) -> str:
    quoted_alias = alias if alias.startswith('"') or " " not in alias else f'"{alias}"'
    by = f" {by_clause}" if by_clause else ""
    return (
        f"| tstats `{DM_SUMMARIES_MACRO}` {agg}({AI}.active_issue_id) as {quoted_alias} "
        f"{DM_FROM}{where_clause(where_filters)}{by}"
    )


def convert_enterprise_status_pipeline(
    rest: list[str],
    where_filters: list[str],
) -> list[str] | None:
    if not rest or not ENTERPRISE_EVAL_RE.search(rest[0]):
        return None
    stats_idx = next(
        (i for i, s in enumerate(rest) if s.lstrip("| ").strip().lower().startswith("stats ")),
        None,
    )
    if stats_idx is None:
        return None
    tstats = (
        f"| tstats `{DM_SUMMARIES_MACRO}` dc({AI}.active_issue_id) as issue_id, "
        f"latest({AI}.active_issue_status) as issue_status "
        f"{DM_FROM}{where_clause(where_filters)} BY {AI}.active_issue_id"
    )
    tail = rest[stats_idx:]
    if tail and tail[0].lstrip("| ").strip().lower().startswith("stats "):
        tail = ["| eval issue_status=lower(issue_status)", *tail]
    return [tstats, *tail]


def convert_issue_group_timechart(
    rest: list[str],
    where_filters: list[str],
) -> list[str] | None:
    if len(rest) < 2:
        return None
    if not ISSUE_GROUP_EVAL_RE.search(rest[0]):
        return None
    tc = rest[1].lstrip("| ").strip()
    if not tc.lower().startswith("timechart"):
        return None
    span = tstats_span_from_timechart(tc)
    limit_m = re.search(r"limit=(\d+)", tc)
    limit = limit_m.group(1) if limit_m else "10"
    eval_stage = rest[0] if rest[0].startswith("|") else "| " + rest[0]
    return [
        build_tstats_dc(
            "count",
            where_filters,
            f"BY _time span={span}, {AI}.active_issue_name, {AI}.active_issue_specific_category",
        ),
        rename_for_fields({"IssueName", "IssueSpecificCategory"}) or RENAME_DIMS,
        eval_stage,
        "| stats sum(count) as count by _time, issue_group",
        f"| timechart sum(count) as count by issue_group limit={limit}",
        *rest[2:],
    ]


def convert_timechart_stage(
    stage: str,
    where_filters: list[str],
) -> list[str] | None:
    body = stage.lstrip("| ").strip()
    if not body.lower().startswith("timechart"):
        return None
    span = tstats_span_from_timechart(stage)

    m_dc = re.search(
        r"timechart(?:\s+fixedrange=false)?\s+dc\(IssueID\)(?:\s+as\s+(\"?[\w ]+\"?))?"
        r"(?:\s+by\s+([\w]+))?(?:\s+limit=\d+)?",
        body,
        re.I,
    )
    if m_dc:
        alias = (m_dc.group(1) or "count").strip()
        by_dim = m_dc.group(2)
        if by_dim:
            if by_dim == "issue_group":
                return None
            by_mapped = map_by_clause(by_dim)
            return [
                build_tstats_dc(
                    alias,
                    where_filters,
                    f"BY _time span={span}, {by_mapped}",
                ),
                rename_for_fields({by_dim}) or "",
            ]
        return [build_tstats_dc(alias, where_filters, f"BY _time span={span}")]

    m_count = re.search(
        r"timechart(?:\s+fixedrange=false)?\s+count(?:\s+as\s+(\w+))?(?:\s+by\s+(.+))?",
        body,
        re.I,
    )
    if m_count:
        alias = m_count.group(1) or "count"
        by_raw = m_count.group(2)
        if by_raw:
            by_mapped = map_by_clause(by_raw.strip())
            tstats = (
                f"| tstats `{DM_SUMMARIES_MACRO}` count as {alias} "
                f"{DM_FROM}{where_clause(where_filters)} BY _time span={span}, {by_mapped}"
            )
            rename = rename_for_fields(set(p.strip() for p in by_raw.split(",")))
            return [tstats, rename] if rename else [tstats]
        return [
            f"| tstats `{DM_SUMMARIES_MACRO}` count as {alias} "
            f"{DM_FROM}{where_clause(where_filters)} BY _time span={span}"
        ]
    return None


def convert_stats_stage(
    stage: str,
    where_filters: list[str],
    tail: list[str],
) -> list[str] | None:
    body = stage.lstrip("| ").strip()

    m_dc = STATS_DC_RE.match(body)
    if m_dc:
        alias = m_dc.group(1).strip()
        by_raw = m_dc.group(2)
        if by_raw:
            by_mapped = map_by_clause(by_raw)
            out = [
                build_tstats_dc(alias, where_filters, f"BY {by_mapped}"),
            ]
            rename = rename_for_fields(fields_referenced(tail) | set(p.strip() for p in by_raw.split(",")))
            if rename:
                out.append(rename)
            return out
        return [build_tstats_dc(alias, where_filters)]

    m_count = STATS_COUNT_BY_RE.match(body)
    if m_count:
        by_raw = m_count.group(1)
        by_mapped = map_by_clause(by_raw)
        out = [
            build_tstats_dc("count", where_filters, f"BY {by_mapped}"),
        ]
        rename = rename_for_fields(fields_referenced(tail) | set(p.strip() for p in by_raw.split(",")))
        if rename:
            out.append(rename)
        return out

    return None


def convert_stages(stages: list[str]) -> list[str] | None:
    if not stages:
        return None

    opener_filters: list[str] = []
    rest: list[str] = []

    first = stages[0].lstrip("| ").strip()
    if OPENER_RE.search(first):
        remainder, opener_filters = extract_opener_filters(
            first if stages[0].startswith("|") else first
        )
        if remainder:
            rest.append(remainder if remainder.startswith("|") else "| " + remainder)
        rest.extend(stages[1:])
    else:
        rest = stages[:]

    enterprise = convert_enterprise_status_pipeline(rest, opener_filters)
    if enterprise:
        return enterprise

    issue_group = convert_issue_group_timechart(rest, opener_filters)
    if issue_group:
        return [s for s in issue_group if s]

    tc_idx = next((i for i, s in enumerate(rest) if TIMECHART_RE.match(s)), None)
    if tc_idx is not None:
        converted = convert_timechart_stage(rest[tc_idx], opener_filters)
        if converted:
            return [s for s in converted + rest[tc_idx + 1 :] if s]

    if rest:
        body = rest[0].lstrip("| ").strip()
        if body.lower().startswith("stats "):
            converted = convert_stats_stage(rest[0], opener_filters, rest[1:])
            if converted:
                return converted + rest[1:]

    return None


def should_skip(name: str, search: str) -> str | None:
    if "datamodel=Cisco_Catalyst_App" in search and "Active_Issue" in search:
        return "already_dm"
    if not OPENER_RE.search(search):
        return "no_opener"
    if any(m in search for m in NON_DM_MARKERS):
        return "non_dm_fields"
    if OTHER_SOURCETYPE_RE.search(search):
        return "composite_sourcetype"
    if " append" in search or "| append" in search or "| join" in search:
        return "composite_append"
    return None


def bump_version(ver: str) -> str:
    parts = ver.split(".")
    if len(parts) == 3 and parts[2].isdigit():
        parts[2] = str(int(parts[2]) + 1)
        return ".".join(parts)
    return "1.1.0"


def convert_file(
    path: Path,
    dry_run: bool = False,
    only: set[str] | None = None,
) -> tuple[int, int, list[str]]:
    fmt = load_formatter()
    text = path.read_text()
    stanzas = parse_stanzas(text)
    converted = 0
    skipped: list[str] = []

    new_stanzas: list[tuple[str, dict[str, str]]] = []
    for name, fields in stanzas:
        if only and name not in only:
            new_stanzas.append((name, fields))
            continue
        search = fields.get("search", "")
        reason = should_skip(name, search)
        if reason:
            if reason != "already_dm":
                skipped.append(f"{name}: {reason}")
            new_stanzas.append((name, fields))
            continue

        stages = unfold_search(search)
        new_pipeline = convert_stages(stages)
        if not new_pipeline:
            skipped.append(f"{name}: convert_failed")
            new_stanzas.append((name, fields))
            continue

        fields = dict(fields)
        fields["search"] = fold_search(new_pipeline)
        fields["dispatch_context"] = "splunk-cisco-dashboards"
        fields["dispatch_context_force"] = "1"
        fields["date_updated"] = "2026-07-01"
        fields["version"] = bump_version(fields.get("version", "1.0.0"))
        converted += 1
        new_stanzas.append((name, fields))

    if dry_run:
        return converted, len(skipped), skipped

    out_parts: list[str] = []
    for name, fields in new_stanzas:
        block, _, _ = fmt.format_stanza(name, fields)
        out_parts.append(block)
    path.write_text("\n\n".join(out_parts).rstrip() + "\n")
    return converted, len(skipped), skipped


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--only", nargs="*", help="Convert only these stanza names")
    args = parser.parse_args()
    only = set(args.only) if args.only else None
    converted, n_skipped, skipped = convert_file(args.source, args.dry_run, only)
    print(f"converted={converted} skipped={n_skipped}")
    for line in skipped:
        print(f"  {line}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
