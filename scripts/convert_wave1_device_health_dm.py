#!/usr/bin/env python3
"""Convert raw cisco:dnac/catalyst:devicehealth searches to Cisco_Catalyst_App tstats.

Wave 1 pilot pattern: dedupe by device_health_ip_address, dispatch in cisco-catalyst-app.
Skips stanzas already converted, RF-only fields not in DM, and composite multi-sourcetype searches.
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

DH = "Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events"
DM_FROM = f"FROM datamodel=Cisco_Catalyst_App WHERE nodename={DH}"
BY_IP = f"BY {DH}.device_health_ip_address"
DM_SUMMARIES_MACRO = "summariesonly"
DM_TSTATS_DEFAULT_SPAN = "30m"

RAW_TO_DM: dict[str, str] = {
    "IpAddress": "device_health_ip_address",
    "DeviceName": "device_health_device_name",
    "DeviceFamily": "device_health_device_family",
    "Reachability": "device_health_reachability",
    "ReachabilityFailureReason": "device_health_reachability_failure_reason",
    "ManageErrors": "device_health_manage_errors",
    "Manageability": "device_health_manageability",
    "MacAddress": "device_health_mac_address",
    "DeviceRole": "device_health_device_role",
    "ImageVersion": "device_health_image_version",
    "Uptime": "device_health_uptime",
    "UptimeSeconds": "device_health_uptime_seconds",
    "LastUpdated": "device_health_last_updated",
    "LastUpdateTime": "device_health_last_update_time",
    "SerialNumber": "device_health_serial_number",
    "DeviceSeries": "device_health_device_series",
    "Platform": "device_health_platform",
    "SupportType": "device_health_support_type",
    "AssociatedWLCIP": "device_health_associated_wlcip",
    "OverallHealth": "device_health_score",
    "HealthScore": "device_health_score",
    "IssueCount": "device_health_issue_count",
    "Site": "device_health_site",
    "Location": "device_health_site",
    "CPUUtilization": "device_health_cpu_utilization",
    "CPUHealth": "device_health_cpu_health",
    "MemoryUtilization": "device_health_memory_utilization",
    "MemoryUtilizationHealth": "device_health_memory_utilization_health",
    "InterfaceLinkErrHealth": "device_health_interface_link_err_health",
}

NON_DM_MARKERS = (
    "InterferenceHealthGhz",
    "AirQualityHealthGhz",
    "UtilizationGhz",
    "NoiseHealthGhz",
    "InterDeviceLinkAvailHealth",
)

OPENER_RE = re.compile(
    r"`index_catalyst`\s+sourcetype(?:\s+IN\s*\(\s*cisco:dnac:devicehealth\s*,\s*cisco:catalyst:devicehealth\s*\)"
    r'|\s*=\s*"cisco:dnac:devicehealth")',
    re.I,
)

OTHER_SOURCETYPE_RE = re.compile(
    r"sourcetype[^\\n]*(?:networkhealth|activeissue|compliance|clienthealth|"
    r"inventory:report|meraki|ise:|syslog|audit|spaces)",
    re.I,
)

LATEST_STATS_RE = re.compile(
    r"^stats\s+(.+?)\s+by\s+(.+?)\s*$",
    re.I,
)

LATEST_FIELD_RE = re.compile(
    r"latest\(([^)]+)\)(?:\s+as\s+([A-Za-z0-9_]+))?",
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


def map_field_expr(expr: str) -> str:
    expr = expr.strip()
    if expr in RAW_TO_DM:
        return f"{DH}.{RAW_TO_DM[expr]}"
    return expr


def map_filter_token(token: str) -> str:
    """Map DeviceFamily=\"X\" style opener filters to DM WHERE clauses."""
    m = re.match(r"([A-Za-z]+)(=|!=|>=|<=|>|<)(.+)", token.strip())
    if not m:
        return token
    field, op, val = m.group(1), m.group(2), m.group(3).strip()
    if field not in RAW_TO_DM:
        return token
    return f"{DH}.{RAW_TO_DM[field]}{op}{val}"


def extract_opener_filters(stage: str) -> tuple[str, list[str]]:
    """Return (remainder_after_opener, dm_where_filters)."""
    m = OPENER_RE.search(stage)
    if not m:
        return stage, []
    after = stage[m.end() :].strip()
    filters: list[str] = []
    if after and not after.startswith("|"):
        # Inline filters before first pipe, e.g. DeviceFamily="Unified AP"
        pipe_idx = after.find(" | ")
        filter_blob = after[:pipe_idx] if pipe_idx >= 0 else after
        if pipe_idx >= 0:
            after = after[pipe_idx + 3 :].strip()
        else:
            after = ""
        # Parenthesized OR groups
        for or_group in re.findall(r"\(([^)]+)\)", filter_blob):
            or_parts = re.findall(r'([A-Za-z]+)\s*=\s*"([^"]+)"', or_group)
            if or_parts:
                mapped = " OR ".join(
                    f'{DH}.{RAW_TO_DM[field]}="{val}"' for field, val in or_parts
                )
                filters.append(f"({mapped})")
            else:
                filters.append(map_filter_token(or_group))
        # Remaining tokens outside parens
        stripped = re.sub(r"\([^)]+\)", "", filter_blob).strip()
        for p in re.findall(r'([A-Za-z]+)\s*=\s*"([^"]+)"', stripped):
            filters.append(f'{DH}.{RAW_TO_DM[p[0]]}="{p[1]}"')
    remainder = after.strip()
    if remainder and not remainder.startswith("|"):
        remainder = "| " + remainder
    return remainder, filters


def parse_latest_stats(stage: str) -> tuple[list[tuple[str, str]], str] | None:
    m = LATEST_STATS_RE.match(stage.lstrip("| ").strip())
    if not m:
        return None
    body, _by = m.group(1), m.group(2)
    fields: list[tuple[str, str]] = []
    for fm in LATEST_FIELD_RE.finditer(body):
        raw = fm.group(1).strip()
        alias = (fm.group(2) or raw).strip()
        if raw.startswith("eval("):
            continue
        fields.append((raw, alias))
    if not fields:
        return None
    by_fields = [b.strip() for b in _by.split(",")]
    seen_aliases = {alias for _, alias in fields}
    for bf in by_fields:
        if bf in RAW_TO_DM and bf not in seen_aliases:
            fields.append((bf, bf))
            seen_aliases.add(bf)
    return fields, _by


def tstats_span_from_bin_line(bin_stage: str) -> str:
    """Map raw ``bin _time`` to tstats ``BY _time span=…`` (tstats does not support bins=)."""
    span_m = re.search(r"span=(\S+)", bin_stage)
    if span_m:
        return span_m.group(1)
    return DM_TSTATS_DEFAULT_SPAN


def build_tstats(
    aggs: list[tuple[str, str]],
    where_filters: list[str],
    by_clause: str | None = None,
) -> str:
    agg_parts: list[str] = []
    seen_dm: set[str] = set()
    for raw, alias in aggs:
        if raw in RAW_TO_DM:
            dm_field = RAW_TO_DM[raw]
            if dm_field in seen_dm and alias == raw:
                continue
            seen_dm.add(dm_field)
            agg_parts.append(f"latest({DH}.{dm_field}) as {alias}")
        else:
            agg_parts.append(f"latest({raw}) as {alias}")
    if not agg_parts:
        agg_parts = [f"count as Count"]
    where = " ".join(where_filters)
    if where:
        where = " " + where
    by = by_clause or BY_IP
    return (
        f"| tstats `{DM_SUMMARIES_MACRO}` {' ,'.join(agg_parts).replace(' ,', ' ')} "
        f"{DM_FROM}{where} {by}"
    )


def collect_fields_from_stages(stages: list[str]) -> list[tuple[str, str]]:
    """Infer fields needed for tstats prelude from pipeline."""
    found: dict[str, str] = {}
    for stage in stages:
        ls = parse_latest_stats(stage)
        if ls:
            for raw, alias in ls[0]:
                found[alias] = raw
        for raw in RAW_TO_DM:
            if re.search(rf"\b{raw}\b", stage):
                if raw not in found.values() and raw not in found:
                    found[raw] = raw
        for alias, dm in RAW_TO_DM.items():
            if re.search(rf"\b{alias}\b", stage) and alias not in found:
                found[alias] = alias
    return [(v, k) for k, v in found.items()]


def strip_redundant_post_tstats(stages: list[str]) -> list[str]:
    if not stages or not stages[0].lstrip().startswith("| tstats"):
        return stages
    out = [stages[0]]
    for stage in stages[1:]:
        if parse_latest_stats(stage):
            continue
        stage = re.sub(r"\bdc\(DeviceID\)", "count", stage)
        stage = re.sub(r"\bby DeviceID\b", "by device_health_ip_address", stage)
        stage = re.sub(r"\bDeviceID,\s*", "", stage)
        stage = re.sub(r",\s*DeviceID\b", "", stage)
        out.append(stage)
    return out


def convert_stages(stages: list[str]) -> list[str] | None:
    if not stages:
        return None
    opener_filters: list[str] = []
    rest: list[str] = []

    first = stages[0].lstrip("| ").strip()
    if OPENER_RE.search(first):
        remainder, opener_filters = extract_opener_filters(first if stages[0].startswith("|") else first)
        if remainder:
            rest.append(remainder if remainder.startswith("|") else "| " + remainder)
        rest.extend(stages[1:])
    else:
        rest = stages[:]

    # Inline OverallHealth>=0 on opener line (no pipe yet)
    if stages and OPENER_RE.search(stages[0]):
        tail = stages[0][OPENER_RE.search(stages[0]).end() :]
        if re.search(r"\bOverallHealth\s*>=\s*0\b", tail):
            opener_filters.append(f"{DH}.device_health_score>=0")

    # Drop coalesce Site/Location eval — DM has device_health_site
    rest = [
        s
        for s in rest
        if not re.search(r"eval\s+Site\s*=\s*coalesce\(Site,\s*Location\)", s, re.I)
    ]

    where_filters = list(opener_filters)

    # Absorb leading where clauses into DM WHERE filters.
    while rest and re.match(r"^\|\s*where\b", rest[0], re.I):
        w = rest[0]
        for raw, dm in RAW_TO_DM.items():
            w = re.sub(rf"\b{raw}\b", f"{DH}.{dm}", w)
        where_filters.append(w.lstrip("| ").replace("where ", "", 1).strip())
        rest = rest[1:]

    new_stages: list[str] = []

    # Trend: bin _time bins=N → per-bucket fleet avg via tstats
    bin_idx = next((i for i, s in enumerate(rest) if re.search(r"^\|\s*bin _time", s)), None)
    if bin_idx is not None:
        span = tstats_span_from_bin_line(rest[bin_idx])
        where = " ".join(where_filters)
        new_stages.append(
            f"| tstats `{DM_SUMMARIES_MACRO}` avg({DH}.device_health_score) as oh "
            f"{DM_FROM} {where} BY _time span={span}"
        )
        rest = [
            s
            for i, s in enumerate(rest)
            if i != bin_idx
            and not parse_latest_stats(s)
            and not re.search(r"eval health=oh\*10", s)
            and not re.search(r"stats latest\(OverallHealth\)", s, re.I)
        ]
        if rest and re.match(r"^\|\s*timechart", rest[0]):
            new_stages.append("| eval health=oh*10")
            new_stages.extend(rest)
            return strip_redundant_post_tstats(new_stages)
        new_stages.append("| eval health=oh*10")
        new_stages.extend(rest)
        return strip_redundant_post_tstats(new_stages)

    # Simple OverallHealth timechart (no per-device binning)
    if any(re.match(r"^\|\s*timechart", s, re.I) for s in rest) and any(
        re.search(r"\bOverallHealth\b", s) for s in rest
    ):
        where = " ".join(where_filters)
        new_stages.append(
            f"| tstats `{DM_SUMMARIES_MACRO}` avg({DH}.device_health_score) as OverallHealth "
            f"{DM_FROM} {where} BY _time"
        )
        rest = [
            s
            for s in rest
            if not re.search(r"eval health=OverallHealth\*10", s, re.I)
            and not re.search(r"eval OverallHealth=tonumber", s, re.I)
        ]
        if not any(re.search(r"eval health=", s, re.I) for s in rest):
            new_stages.append("| eval health=OverallHealth*10")
        new_stages.extend(rest)
        return strip_redundant_post_tstats(new_stages)

    # Reachability/manageability scored timechart on raw events
    if rest and re.match(r"^\|\s*timechart", rest[0], re.I) and "Reachability" in rest[0]:
        where = " ".join(where_filters)
        new_stages.append(
            f"| tstats `{DM_SUMMARIES_MACRO}` latest({DH}.device_health_reachability) as Reachability, "
            f"latest({DH}.device_health_manageability) as Manageability {DM_FROM} {where} "
            f"BY _time, {DH}.device_health_ip_address"
        )
        new_stages.append(rest[0])
        return strip_redundant_post_tstats(new_stages)

    # Pattern: stats latest ... by DeviceID|DeviceName as first stage after opener
    if rest and parse_latest_stats(rest[0]):
        parsed = parse_latest_stats(rest[0])
        assert parsed is not None
        fields, _ = parsed
        new_stages.append(build_tstats(fields, where_filters))
        rest = rest[1:]
        # Drop redundant second-pass latest() by device key after tstats dedupe.
        if rest and parse_latest_stats(rest[0]):
            rest = rest[1:]
    elif rest and re.match(r"^\|\s*timechart", rest[0], re.I) and re.search(
        r"\bOverallHealth\b", rest[0]
    ):
        # Direct timechart on events
        where = " ".join(where_filters)
        if "device_health_score" not in where:
            where = (where + f" {DH}.device_health_score>=0").strip()
        span = ""
        if "span=" in rest[0]:
            sm = re.search(r"span=(\S+)", rest[0])
            if sm:
                span = f" span={sm.group(1)}"
        new_stages.append(
            f"| tstats `{DM_SUMMARIES_MACRO}` avg({DH}.device_health_score) as OverallHealth "
            f"{DM_FROM} {where} BY _time{span}"
        )
        tc = rest[0]
        tc = re.sub(r"avg\(\s*OverallHealth\s*\)", "avg(OverallHealth)", tc, flags=re.I)
        tc = re.sub(
            r"avg\(eval\(round\(OverallHealth\s*\*\s*10",
            "avg(eval(round(OverallHealth * 10",
            tc,
            flags=re.I,
        )
        rest[0] = tc
    elif rest and (
        re.search(r"eval\s+h\s*=\s*case\(Reachability", rest[0], re.I)
        or (
            rest[0].lstrip("| ").startswith("eval ")
            and "Reachability" in rest[0]
            and "Manageability" in rest[0]
        )
    ):
        new_stages.append(
            build_tstats(
                [("Reachability", "Reachability"), ("Manageability", "Manageability")],
                where_filters,
            )
        )
    elif rest and re.match(r"^\|\s*where\b", rest[0], re.I):
        # where without following timechart — handled above; fall through
        fields = collect_fields_from_stages(rest)
        if not fields:
            fields = [("Reachability", "Reachability"), ("OverallHealth", "OverallHealth")]
        w = rest[0]
        for raw, dm in RAW_TO_DM.items():
            w = re.sub(rf"\b{raw}\b", f"{DH}.{dm}", w)
        where_filters.append(w.lstrip("| ").replace("where ", "", 1).strip())
        new_stages.append(build_tstats(fields, where_filters))
        rest = rest[1:]
    else:
        fields = collect_fields_from_stages(rest)
        if fields:
            new_stages.append(build_tstats(fields, where_filters))
        else:
            return None

    new_stages.extend(rest)
    return strip_redundant_post_tstats(new_stages)


def should_skip(name: str, search: str) -> str | None:
    if "datamodel=Cisco_Catalyst_App" in search:
        return "already_dm"
    if not OPENER_RE.search(search):
        return "no_opener"
    if any(m in search for m in NON_DM_MARKERS):
        return "non_dm_rf_fields"
    if OTHER_SOURCETYPE_RE.search(search):
        return "composite_sourcetype"
    if " append" in search or "| append" in search or "appendcols" in search:
        return "composite_append"
    if "inputlookup" in search:
        return "lookup"
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
        fields["dispatch_context"] = "cisco-catalyst-app"
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
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    converted, n_skipped, skipped = convert_file(args.source, dry_run=args.dry_run)
    print(f"Converted: {converted}")
    print(f"Skipped: {n_skipped}")
    for line in skipped[:30]:
        print(f"  {line}")
    if n_skipped > 30:
        print(f"  ... and {n_skipped - 30} more")
    return 0


if __name__ == "__main__":
    sys.exit(main())
