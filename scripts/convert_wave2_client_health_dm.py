#!/usr/bin/env python3
"""Convert raw cisco:dnac/catalyst:clienthealth searches to Cisco_Catalyst_App tstats.

Wave 2: Cisco_Catalyst_Client_Inventory_And_Health_Score_Events dataset.
Skips composite append, multi-sourcetype, and lookup-heavy stanzas.
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

CH = "Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_Health_Score_Events"
DM_FROM = f"FROM datamodel=Cisco_Catalyst_App WHERE nodename={CH}"
DM_SUMMARIES_MACRO = "summariesonly"
DM_TSTATS_DEFAULT_SPAN = "30m"

RAW_TO_DM: dict[str, str] = {
    "clientType": "client_health_client_type",
    "scoreType": "client_health_score_type",
    "clientCount": "client_health_client_count",
    "scoreValue": "client_health_score_value",
    "siteId": "client_health_site_id",
}

RENAME_DIMS = (
    f"| rename {CH}.client_health_client_type as clientType, "
    f"{CH}.client_health_score_type as scoreType, "
    f"{CH}.client_health_site_id as siteId"
)

OPENER_RE = re.compile(
    r"`index_catalyst`\s+sourcetype(?:\s+IN\s*\(\s*cisco:dnac:clienthealth\s*,\s*cisco:catalyst:clienthealth\s*\)"
    r'|\s*=\s*"cisco:dnac:clienthealth")',
    re.I,
)

OTHER_SOURCETYPE_RE = re.compile(
    r"sourcetype[^\\n]*(?:devicehealth|networkhealth|activeissue|compliance|"
    r"cisco:dnac:client[^h]|cisco:catalyst:client[^h]|meraki|ise:|syslog|audit|spaces)",
    re.I,
)

LATEST_STATS_RE = re.compile(
    r"^stats\s+(.+?)\s+by\s+(.+?)\s*$",
    re.I,
)

STATS_NO_BY_RE = re.compile(r"^stats\s+(.+?)\s*$", re.I)

LATEST_FIELD_RE = re.compile(
    r"latest\(([^)]+)\)(?:\s+as\s+([A-Za-z0-9_]+))?",
    re.I,
)

TIMECHART_RE = re.compile(r"^\|\s*timechart\b", re.I)


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


def map_dm_field(raw: str) -> str:
    raw = raw.strip()
    if raw in RAW_TO_DM:
        return f"{CH}.{RAW_TO_DM[raw]}"
    return raw


def map_filter_token(token: str) -> str:
    token = token.strip()
    m = re.match(r"([A-Za-z]+)(=|!=|>=|<=|>|<)(.+)", token)
    if not m:
        return token
    field, op, val = m.group(1), m.group(2), m.group(3).strip()
    if field not in RAW_TO_DM:
        return token
    return f"{CH}.{RAW_TO_DM[field]}{op}{val}"


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
            or_parts = re.findall(r'([A-Za-z]+)\s*=\s*"([^"]+)"', or_group)
            if or_parts:
                mapped = " OR ".join(
                    f'{CH}.{RAW_TO_DM[field]}="{val}"' for field, val in or_parts
                )
                filters.append(f"({mapped})")
        stripped = re.sub(r"\([^)]+\)", "", filter_blob).strip()
        for field, val in re.findall(r'([A-Za-z]+)\s*=\s*"([^"]+)"', stripped):
            filters.append(f'{CH}.{RAW_TO_DM[field]}="{val}"')
        for field in RAW_TO_DM:
            if re.search(rf"\b{field}\s*=\s*\*", filter_blob):
                filters.append(f"{CH}.{RAW_TO_DM[field]}=*")
    remainder = after.strip()
    if remainder and not remainder.startswith("|"):
        remainder = "| " + remainder
    return remainder, filters


def map_by_clause(by_raw: str) -> str:
    parts = [p.strip() for p in by_raw.split(",")]
    mapped: list[str] = []
    for part in parts:
        if part == "_time":
            mapped.append("_time")
            continue
        if part in RAW_TO_DM:
            mapped.append(f"{CH}.{RAW_TO_DM[part]}")
        else:
            mapped.append(part)
    return ", ".join(mapped)


def tstats_span_from_bin_line(bin_stage: str) -> str:
    span_m = re.search(r"span=(\S+)", bin_stage)
    if span_m:
        return span_m.group(1)
    return DM_TSTATS_DEFAULT_SPAN


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
    seen_dm: set[str] = set()
    for raw, alias in aggs:
        expr = raw.strip()
        if expr.startswith("eval("):
            continue
        if expr in RAW_TO_DM:
            dm_field = RAW_TO_DM[expr]
            if dm_field in seen_dm and alias == expr:
                continue
            seen_dm.add(dm_field)
            agg_parts.append(f"latest({CH}.{dm_field}) as {alias}")
        else:
            agg_parts.append(f"latest({expr}) as {alias}")
    if not agg_parts:
        agg_parts = ["count as Count"]
    where = " ".join(where_filters)
    if where:
        where = " " + where
    by = by_clause or ""
    if by:
        by = f" {by}"
    return (
        f"| tstats `{DM_SUMMARIES_MACRO}` {' ,'.join(agg_parts).replace(' ,', ' ')} "
        f"{DM_FROM}{where}{by}"
    )


def parse_latest_stats(stage: str) -> tuple[list[tuple[str, str]], str] | None:
    body = stage.lstrip("| ").strip()
    m = LATEST_STATS_RE.match(body)
    if not m:
        return None
    agg_body, by_raw = m.group(1), m.group(2)
    fields: list[tuple[str, str]] = []
    for fm in LATEST_FIELD_RE.finditer(agg_body):
        raw = fm.group(1).strip()
        alias = (fm.group(2) or raw).strip()
        fields.append((raw, alias))
    if not fields:
        return None
    return fields, by_raw


def parse_latest_stats_no_by(stage: str) -> list[tuple[str, str]] | None:
    body = stage.lstrip("| ").strip()
    if not body.lower().startswith("stats "):
        return None
    if re.search(r"\sby\s", body, re.I):
        return None
    m = STATS_NO_BY_RE.match(body)
    if not m:
        return None
    fields: list[tuple[str, str]] = []
    for fm in LATEST_FIELD_RE.finditer(m.group(1)):
        raw = fm.group(1).strip()
        alias = (fm.group(2) or raw).strip()
        fields.append((raw, alias))
    return fields or None


def needs_dim_rename(stages: list[str]) -> bool:
    blob = " ".join(stages)
    return any(
        re.search(rf"\b{dim}\b", blob)
        for dim in ("clientType", "scoreType", "siteId")
    )


def map_where_stage(stage: str) -> str:
    w = stage.lstrip("| ").strip()
    if not w.lower().startswith("where "):
        return stage
    for raw, dm in RAW_TO_DM.items():
        w = re.sub(rf"\b{raw}\b", f"{CH}.{dm}", w)
    return "| " + w


def convert_timechart_conditional(stage: str, where_filters: list[str]) -> list[str] | None:
    """timechart latest(eval(if(scoreType==...,clientCount,null()))) as ..."""
    if "latest(eval(if(" not in stage or "clientCount" not in stage:
        return None
    span = tstats_span_from_timechart(stage)
    where = " ".join(where_filters)
    where_clause = f" {where}" if where else ""
    by = f"BY _time span={span}, {CH}.client_health_score_type"
    tstats = (
        f"| tstats `{DM_SUMMARIES_MACRO}` latest({CH}.client_health_client_count) as cc "
        f"{DM_FROM}{where_clause} {by}"
    )
    bands: list[tuple[str, str]] = []
    for label_m in re.finditer(
        r'latest\(eval\(if\(([^)]+),clientCount,null\(\)\)\)\)\s+as\s+("?[\w ]+"?)',
        stage,
        re.I,
    ):
        cond, alias = label_m.group(1), label_m.group(2).strip('"')
        bands.append((cond, alias))
    if not bands:
        return None
    eval_parts: list[str] = []
    collapse_parts: list[str] = []
    for cond, alias in bands:
        dm_cond = cond
        for raw in RAW_TO_DM:
            dm_cond = re.sub(rf"\b{raw}\b", raw, dm_cond)
        safe_alias = alias.replace(" ", "_")
        eval_parts.append(f"{safe_alias}=if({dm_cond},cc,null())")
        collapse_parts.append(f'max({safe_alias}) as {"No Data" if alias == "No Data" else alias}')
    return [
        tstats,
        RENAME_DIMS,
        f"| eval {', '.join(eval_parts)}",
        f"| stats {', '.join(collapse_parts)} by _time",
    ]


def convert_timechart_max_by_scoretype(stage: str, where_filters: list[str]) -> list[str] | None:
    if not re.search(r"timechart\s+max\(clientCount\)", stage, re.I):
        return None
    span = tstats_span_from_timechart(stage)
    where = " ".join(where_filters)
    where_clause = f" {where}" if where else ""
    return [
        f"| tstats `{DM_SUMMARIES_MACRO}` max({CH}.client_health_client_count) as clientCount "
        f"{DM_FROM}{where_clause} BY _time span={span}, {CH}.client_health_score_type",
        RENAME_DIMS,
    ]


def convert_bucket_drilldown(stages: list[str], where_filters: list[str]) -> list[str] | None:
    if len(stages) < 2:
        return None
    if not re.search(r'eval\s+Bucket\s*=\s*case\(scoreType', stages[0], re.I):
        return None
    stats_m = parse_latest_stats(stages[1])
    if not stats_m or "Bucket" not in stats_m[1]:
        return None
    fields, _ = stats_m
    where = " ".join(where_filters)
    where_clause = f" {where}" if where else ""
    agg_parts: list[str] = []
    for raw, alias in fields:
        if raw == "clientCount":
            agg_parts.append(f"latest({CH}.client_health_client_count) as {alias}")
        elif raw == "_time":
            agg_parts.append(f"max(_time) as {alias}")
    if not agg_parts:
        return None
    out = [
        f"| tstats `{DM_SUMMARIES_MACRO}` {', '.join(agg_parts)} "
        f"{DM_FROM}{where_clause} BY {CH}.client_health_score_type",
        RENAME_DIMS,
        stages[0],
        stages[1],
    ]
    out.extend(stages[2:])
    return out


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

    where_filters = list(opener_filters)

    while rest and re.match(r"^\|\s*where\b", rest[0], re.I):
        w = rest[0].lstrip("| ").strip()
        clause = w.replace("where ", "", 1).strip()
        for raw, dm in RAW_TO_DM.items():
            clause = re.sub(rf"\b{raw}\b", f"{CH}.{dm}", clause)
        where_filters.append(clause)
        rest = rest[1:]

    new_stages: list[str] = []

    # bin _time + stats latest(clientCount) by _time, clientType, scoreType
    bin_idx = next((i for i, s in enumerate(rest) if re.search(r"^\|\s*bin _time", s)), None)
    if bin_idx is not None:
        span = tstats_span_from_bin_line(rest[bin_idx])
        stats_idx = next(
            (i for i, s in enumerate(rest) if i > bin_idx and parse_latest_stats(s)),
            None,
        )
        if stats_idx is not None:
            parsed = parse_latest_stats(rest[stats_idx])
            assert parsed is not None
            fields, by_raw = parsed
            by_mapped = map_by_clause(by_raw)
            if "_time" in by_raw:
                by_mapped = re.sub(
                    r"\b_time\b",
                    f"_time span={span}",
                    by_mapped,
                    count=1,
                )
            where = " ".join(where_filters)
            new_stages.append(build_tstats(fields, where_filters, f"BY {by_mapped}"))
            if needs_dim_rename(rest[stats_idx:]):
                new_stages.append(RENAME_DIMS)
            rest = [s for i, s in enumerate(rest) if i not in (bin_idx, stats_idx)]
            if rest and parse_latest_stats(rest[0]):
                rest = rest[1:]
            new_stages.extend(rest)
            return new_stages

    # eval Bucket drilldown before stats by Bucket
    if rest and re.search(r'eval\s+Bucket\s*=\s*case\(scoreType', rest[0], re.I):
        converted = convert_bucket_drilldown(rest, where_filters)
        if converted:
            return converted

    # timechart with conditional latest per scoreType
    tc_idx = next((i for i, s in enumerate(rest) if TIMECHART_RE.match(s)), None)
    if tc_idx is not None and "latest(eval(if(" in rest[tc_idx]:
        converted = convert_timechart_conditional(rest[tc_idx], where_filters)
        if converted:
            new_stages.extend(converted)
            rest = rest[:tc_idx] + rest[tc_idx + 1 :]
            new_stages.extend(rest)
            return new_stages

    # timechart max(clientCount) by scoreType
    if tc_idx is not None:
        converted_max = convert_timechart_max_by_scoretype(rest[tc_idx], where_filters)
        if converted_max:
            new_stages.extend(converted_max)
            rest = rest[:tc_idx] + rest[tc_idx + 1 :]
            new_stages.extend(rest)
            return new_stages

    # timechart latest(scoreValue) or latest(clientCount)
    if tc_idx is not None:
        tc = rest[tc_idx]
        span = tstats_span_from_timechart(tc)
        where = " ".join(where_filters)
        where_clause = f" {where}" if where else ""
        if re.search(r"latest\(scoreValue\)", tc, re.I):
            new_stages.append(
                f"| tstats `{DM_SUMMARIES_MACRO}` latest({CH}.client_health_score_value) as sv "
                f"{DM_FROM}{where_clause} BY _time span={span}"
            )
            rest = rest[:tc_idx] + rest[tc_idx + 1 :]
            rest = [
                s
                for s in rest
                if not re.search(r"eval health=round\(health", s, re.I)
            ]
            if not any(re.search(r"eval health=round\(sv", s, re.I) for s in rest):
                new_stages.append("| eval health=round(sv, 2)")
            new_stages.extend(rest)
            return new_stages
        if re.search(r"latest\(clientCount\)", tc, re.I):
            alias_m = re.search(r"latest\(clientCount\)\s+as\s+(\w+)", tc, re.I)
            alias = alias_m.group(1) if alias_m else "total_clients"
            new_stages.append(
                f"| tstats `{DM_SUMMARIES_MACRO}` latest({CH}.client_health_client_count) as {alias} "
                f"{DM_FROM}{where_clause} BY _time span={span}"
            )
            rest = rest[:tc_idx] + rest[tc_idx + 1 :]
            new_stages.extend(rest)
            return new_stages
        if re.search(r"timechart.*\bby\s+clientType\b", tc, re.I):
            new_stages.append(
                f"| tstats `{DM_SUMMARIES_MACRO}` avg({CH}.client_health_score_value) as health "
                f"{DM_FROM}{where_clause} BY _time span={span}, {CH}.client_health_client_type"
            )
            new_stages.append(RENAME_DIMS)
            rest = rest[:tc_idx] + rest[tc_idx + 1 :]
            rest = [
                s
                for s in rest
                if not re.search(r"eval health=if\(scoreValue", s, re.I)
            ]
            new_stages.extend(rest)
            return new_stages

    # stats latest ... (with or without by)
    if rest and (parse_latest_stats(rest[0]) or parse_latest_stats_no_by(rest[0])):
        parsed_by = parse_latest_stats(rest[0])
        parsed_no = parse_latest_stats_no_by(rest[0])
        if parsed_by:
            fields, by_raw = parsed_by
            by_clause = f"BY {map_by_clause(by_raw)}"
            new_stages.append(build_tstats(fields, where_filters, by_clause))
            rest = rest[1:]
            if needs_dim_rename(rest):
                new_stages.append(RENAME_DIMS)
            if rest and parse_latest_stats(rest[0]):
                rest = rest[1:]
        elif parsed_no:
            new_stages.append(build_tstats(parsed_no, where_filters))
            rest = rest[1:]
    else:
        return None

    new_stages.extend(rest)
    return new_stages


def should_skip(name: str, search: str) -> str | None:
    if "datamodel=Cisco_Catalyst_App" in search and "Client_Inventory" in search:
        return "already_dm"
    if not OPENER_RE.search(search):
        return "no_opener"
    if OTHER_SOURCETYPE_RE.search(search):
        return "composite_sourcetype"
    if " append" in search or "| append" in search or "appendcols" in search:
        return "composite_append"
    if "inputlookup" in search or "| lookup" in search:
        return "lookup"
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
    for line in skipped[:40]:
        print(f"  {line}")
    if n_skipped > 40:
        print(f"  ... and {n_skipped - 40} more")
    return 0


if __name__ == "__main__":
    sys.exit(main())
