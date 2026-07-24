#!/usr/bin/env python3
"""Convert raw cisco:dnac/catalyst:networkhealth searches to Cisco_Catalyst_App tstats.

Wave 3: Cisco_Catalyst_Network_Health_Events dataset.
Skips composite append, non-DM count/percentage fields, and fixes prior misroutes.
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

NH = "Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Health_Events"
DM_FROM = f"FROM datamodel=Cisco_Catalyst_App WHERE nodename={NH}"
DM_SUMMARIES_MACRO = "summariesonly"
DM_TSTATS_DEFAULT_SPAN = "30m"

RAW_TO_DM: dict[str, str] = {
    "category": "network_health_category",
    "healthScore": "network_health_score",
}

RENAME_DIMS = f"| rename {NH}.network_health_category as category"

OPENER_RE = re.compile(
    r"`index_catalyst`\s+sourcetype(?:\s+IN\s*\(\s*cisco:dnac:networkhealth\s*,\s*cisco:catalyst:networkhealth\s*\)"
    r'|\s*=\s*"cisco:dnac:networkhealth")',
    re.I,
)

NON_DM_MARKERS = (
    "goodPercentage",
    "fairPercentage",
    "badPercentage",
    "goodCount",
    "fairCount",
    "badCount",
    "totalCount",
    "noHealthCount",
)

OTHER_SOURCETYPE_RE = re.compile(
    r"sourcetype[^\\n]*(?:devicehealth|clienthealth|activeissue|compliance|"
    r"cisco:dnac:client[^h]|cisco:catalyst:client[^h])",
    re.I,
)

LATEST_STATS_RE = re.compile(r"^stats\s+(.+?)\s+by\s+(.+?)\s*$", re.I)
STATS_NO_BY_RE = re.compile(r"^stats\s+(.+?)\s*$", re.I)
LATEST_FIELD_RE = re.compile(
    r"latest\(([^)]+)\)(?:\s+as\s+([A-Za-z0-9_ %\"]+))?",
    re.I,
)
MAX_TIME_RE = re.compile(
    r"max\(_time\)(?:\s+as\s+([A-Za-z0-9_ %\"]+))?",
    re.I,
)
TIMECHART_RE = re.compile(r"^\|\s*timechart\b", re.I)

# Wave 1 reachability timechart was applied to a networkhealth rollup stanza.
MISROUTED_FIXES: dict[str, list[str]] = {
    "executive_summary_network_health_trend": [
        f"| tstats `{DM_SUMMARIES_MACRO}` latest({NH}.network_health_score) as pct "
        f"{DM_FROM} {NH}.network_health_category=\"All\" BY _time span=30m",
    ],
}


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
            mapped.append(f"{NH}.{RAW_TO_DM[part]}")
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
                    f'{NH}.{RAW_TO_DM[field]}{op}"{val}"'
                    for field, op, val in or_parts
                )
                filters.append(f"({mapped})")
        stripped = re.sub(r"\([^)]+\)", "", filter_blob).strip()
        for field, op, val in re.findall(r'([A-Za-z]+)\s*(!=|=)\s*"([^"]+)"', stripped):
            filters.append(f'{NH}.{RAW_TO_DM[field]}{op}"{val}"')
    remainder = after.strip()
    if remainder and not remainder.startswith("|"):
        remainder = "| " + remainder
    return remainder, filters


def tstats_span_from_bin_line(bin_stage: str) -> str:
    span_m = re.search(r"span=(\S+)", bin_stage)
    return span_m.group(1) if span_m else DM_TSTATS_DEFAULT_SPAN


def tstats_span_from_timechart(tc_stage: str) -> str:
    span_m = re.search(r"span=(\S+)", tc_stage)
    if span_m:
        return span_m.group(1)
    if re.search(r"fixedrange=false", tc_stage, re.I):
        return "1h"
    return DM_TSTATS_DEFAULT_SPAN


def build_tstats(
    aggs: list[tuple[str, str]],
    where_filters: list[str],
    by_clause: str | None = None,
) -> str:
    agg_parts: list[str] = []
    for raw, alias in aggs:
        expr = raw.strip()
        quoted_alias = alias if " " in alias else alias
        if " " in alias and not alias.startswith('"'):
            quoted_alias = f'"{alias}"'
        if expr == "_time":
            agg_parts.append(f"max(_time) as {quoted_alias}")
        elif expr in RAW_TO_DM:
            agg_parts.append(f"latest({NH}.{RAW_TO_DM[expr]}) as {quoted_alias}")
        else:
            agg_parts.append(f"latest({expr}) as {quoted_alias}")
    if not agg_parts:
        agg_parts = ["count as Count"]
    where = " ".join(where_filters)
    where_clause = f" {where}" if where else ""
    by = f" {by_clause}" if by_clause else ""
    return (
        f"| tstats `{DM_SUMMARIES_MACRO}` {', '.join(agg_parts)} "
        f"{DM_FROM}{where_clause}{by}"
    )


def clean_alias(alias: str) -> str:
    return alias.strip().strip('"')


def parse_stats_fields(body: str) -> list[tuple[str, str]]:
    fields: list[tuple[str, str]] = []
    for fm in LATEST_FIELD_RE.finditer(body):
        raw = fm.group(1).strip()
        alias = clean_alias(fm.group(2) or raw)
        fields.append((raw, alias))
    for fm in MAX_TIME_RE.finditer(body):
        alias = clean_alias(fm.group(1) or "last_seen")
        fields.append(("_time", alias))
    return fields


def parse_latest_stats(stage: str) -> tuple[list[tuple[str, str]], str] | None:
    body = stage.lstrip("| ").strip()
    m = LATEST_STATS_RE.match(body)
    if not m:
        return None
    fields = parse_stats_fields(m.group(1))
    return (fields, m.group(2)) if fields else None


def parse_latest_stats_no_by(stage: str) -> list[tuple[str, str]] | None:
    body = stage.lstrip("| ").strip()
    if not body.lower().startswith("stats ") or re.search(r"\sby\s", body, re.I):
        return None
    m = STATS_NO_BY_RE.match(body)
    if not m:
        return None
    fields = parse_stats_fields(m.group(1))
    return fields or None


def needs_category_rename(stages: list[str]) -> bool:
    return any(re.search(r"\bcategory\b", s) for s in stages)


def convert_wow_health(rest: list[str], where_filters: list[str]) -> list[str]:
    where = " ".join(where_filters)
    where_clause = f" {where}" if where else ""
    return [
        f"| tstats `{DM_SUMMARIES_MACRO}` avg({NH}.network_health_score) as healthScore "
        f"{DM_FROM}{where_clause} BY _time span=1h",
        *rest,
    ]


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

    new_stages: list[str] = []

    # Week-over-week: tstats hourly avg then eval/stats on _time
    if rest and re.search(r"eval\s+is_this_week\s*=", rest[0], re.I):
        return convert_wow_health(rest, opener_filters)

    bin_idx = next((i for i, s in enumerate(rest) if re.search(r"^\|\s*bin _time", s)), None)
    if bin_idx is not None:
        span = tstats_span_from_bin_line(rest[bin_idx])
        stats_idx = next(
            (i for i, s in enumerate(rest) if i > bin_idx and parse_latest_stats(s)),
            None,
        )
        if stats_idx is not None:
            fields, by_raw = parse_latest_stats(rest[stats_idx])  # type: ignore[misc]
            by_mapped = map_by_clause(by_raw)
            if "_time" in by_raw:
                by_mapped = re.sub(r"\b_time\b", f"_time span={span}", by_mapped, count=1)
            new_stages.append(build_tstats(fields, opener_filters, f"BY {by_mapped}"))
            rest = [s for i, s in enumerate(rest) if i not in (bin_idx, stats_idx)]
            new_stages.extend(rest)
            return new_stages

    tc_idx = next((i for i, s in enumerate(rest) if TIMECHART_RE.match(s)), None)
    if tc_idx is not None:
        tc = rest[tc_idx]
        span = tstats_span_from_timechart(tc)
        where = " ".join(opener_filters)
        where_clause = f" {where}" if where else ""
        if re.search(r"latest\(healthScore\)", tc, re.I):
            alias_m = re.search(r"latest\(healthScore\)\s+as\s+(\w+)", tc, re.I)
            alias = alias_m.group(1) if alias_m else "health"
            new_stages.append(
                f"| tstats `{DM_SUMMARIES_MACRO}` latest({NH}.network_health_score) as {alias} "
                f"{DM_FROM}{where_clause} BY _time span={span}"
            )
            rest = rest[:tc_idx] + rest[tc_idx + 1 :]
            new_stages.extend(rest)
            return new_stages

    if rest and (parse_latest_stats(rest[0]) or parse_latest_stats_no_by(rest[0])):
        parsed_by = parse_latest_stats(rest[0])
        parsed_no = parse_latest_stats_no_by(rest[0])
        if parsed_by:
            fields, by_raw = parsed_by
            new_stages.append(build_tstats(fields, opener_filters, f"BY {map_by_clause(by_raw)}"))
            rest = rest[1:]
            if needs_category_rename(rest):
                new_stages.append(RENAME_DIMS)
            if rest and parse_latest_stats(rest[0]):
                rest = rest[1:]
        elif parsed_no:
            new_stages.append(build_tstats(parsed_no, opener_filters))
            rest = rest[1:]
    else:
        return None

    new_stages.extend(rest)
    return new_stages


def should_skip(name: str, search: str) -> str | None:
    if name in MISROUTED_FIXES:
        return None
    if "datamodel=Cisco_Catalyst_App" in search and "Network_Health_Events" in search:
        return "already_dm"
    if not OPENER_RE.search(search):
        return "no_opener"
    if any(m in search for m in NON_DM_MARKERS):
        return "non_dm_fields"
    if OTHER_SOURCETYPE_RE.search(search):
        return "composite_sourcetype"
    if " append" in search or "| append" in search:
        return "composite_append"
    return None


def bump_version(ver: str) -> str:
    parts = ver.split(".")
    if len(parts) == 3 and parts[2].isdigit():
        parts[2] = str(int(parts[2]) + 1)
        return ".".join(parts)
    return "1.1.0"


def convert_file(path: Path, dry_run: bool = False) -> tuple[int, int, list[str]]:
    fmt = load_formatter()
    text = path.read_text()
    stanzas = parse_stanzas(text)
    converted = 0
    skipped: list[str] = []

    new_stanzas: list[tuple[str, dict[str, str]]] = []
    for name, fields in stanzas:
        search = fields.get("search", "")

        if name in MISROUTED_FIXES:
            fields = dict(fields)
            fields["search"] = fold_search(MISROUTED_FIXES[name])
            fields["dispatch_context"] = "splunk-cisco-dashboards"
            fields["dispatch_context_force"] = "1"
            fields["date_updated"] = "2026-07-01"
            fields["version"] = bump_version(fields.get("version", "1.0.0"))
            converted += 1
            new_stanzas.append((name, fields))
            continue

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
    args = parser.parse_args()
    converted, n_skipped, skipped = convert_file(args.source, args.dry_run)
    print(f"converted={converted} skipped={n_skipped}")
    for line in skipped:
        if "network" in line.lower() or "executive_dashboard" in line:
            print(f"  {line}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
