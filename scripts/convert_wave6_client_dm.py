#!/usr/bin/env python3
"""Convert raw cisco:dnac/catalyst:client searches to Cisco_Catalyst_App tstats.

Wave 6: Cisco_Catalyst_Client_Events dataset.
Skips SSID/band/OS, session duration, site enrichment, and composite stanzas.
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

CE = "Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Events"
DM_FROM = f"FROM datamodel=Cisco_Catalyst_App WHERE nodename={CE}"
DM_SUMMARIES_MACRO = "summariesonly"
DM_TSTATS_DEFAULT_SPAN = "30m"

RAW_TO_DM: dict[str, str] = {
    "type": "client_count_type",
    "macAddress": "client_count_macaddress",
    "name": "client_count_name",
    "ipv4Address": "client_count_ipv4Address",
    "connection.protocol": "client_count_connection_protocol",
    "connectionStatus": "client_count_connection_status",
    "traffic.rxBytes": "client_count_rx_bytes",
    "traffic.txBytes": "client_count_tx_bytes",
    "traffic.usage": "client_count_usage",
    "health.overallScore": "client_count_overall_score",
    "health.connectedScore": "client_count_connected_score",
    "health.onboardingScore": "client_count_onboarding_score",
    "siteHierarchy": "client_count_site",
    "connectedNetworkDevice.connectedNetworkDeviceType": (
        "client_count_connected_network_device_type"
    ),
}

OPENER_RE = re.compile(
    r"`index_catalyst`\s+.*sourcetype(?:\s+IN\s*\(\s*cisco:dnac:client\s*,\s*"
    r"cisco:catalyst:client\s*\)|\s*=\s*\"cisco:dnac:client\"|"
    r"\(sourcetype=\"cisco:dnac:client\")",
    re.I,
)

NON_DM_MARKERS = (
    "connection.ssid",
    "connection.band",
    "osType",
    "deviceType",
    "healthScore",
    "connection.sessionDuration",
    "connection.rssi",
    "onboarding.",
    "connection.authType",
    "dnac_site_normalize",
    "inputlookup",
    "| lookup",
    "index_spaces",
    "| union",
    "cisco:ios",
    "clienthealth",
    "devicehealth",
    " append",
    "| append",
    "| join",
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


def where_clause(filters: list[str]) -> str:
    where = " ".join(filters)
    return f" {where}" if where else ""


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
        for field, op, val in re.findall(r'([A-Za-z]+)\s*(!=|=)\s*"([^"]+)"', filter_blob):
            if field in RAW_TO_DM:
                filters.append(f'{CE}.{RAW_TO_DM[field]}{op}"{val}"')
        for field, op, val in re.findall(
            r"(connectionStatus)\s*(!=|=)\s*\"([^\"]+)\"", filter_blob
        ):
            if field in RAW_TO_DM:
                filters.append(f'{CE}.{RAW_TO_DM[field]}{op}"{val}"')
    remainder = after.strip()
    if remainder and not remainder.startswith("|"):
        remainder = "| " + remainder
    return remainder, filters


def rename_field(raw: str, alias: str | None = None) -> str:
    dm = RAW_TO_DM.get(raw)
    if not dm:
        return ""
    target = alias or raw.split(".")[-1]
    return f"{CE}.{dm} as {target}"


def tstats_span_from_timechart(tc_stage: str) -> str:
    span_m = re.search(r"span=(\S+)", tc_stage)
    if span_m:
        return span_m.group(1)
    if re.search(r"bins=\d+", tc_stage):
        return "1h"
    if re.search(r"fixedrange=false", tc_stage, re.I):
        return "1h"
    return DM_TSTATS_DEFAULT_SPAN


def convert_dc_by_protocol(rest: list[str], where_filters: list[str]) -> list[str] | None:
    stats_idx = next(
        (
            i
            for i, s in enumerate(rest)
            if re.search(r"stats\s+dc\(macAddress\)\s+as\s+clients\s+by\s+protocol", s, re.I)
            or re.search(
                r"stats\s+dc\(macAddress\)\s+as\s+clients\s+by\s+connection\.protocol",
                s,
                re.I,
            )
        ),
        None,
    )
    if stats_idx is None:
        return None
    alias_m = re.search(r"as\s+(\w+)", rest[stats_idx])
    alias = alias_m.group(1) if alias_m else "clients"
    proto_alias = "protocol"
    if "by protocol" in rest[stats_idx].lower():
        proto_alias = "protocol"
    elif "connection.protocol" in rest[stats_idx]:
        proto_alias = "protocol"
    tstats = (
        f"| tstats `{DM_SUMMARIES_MACRO}` dc({CE}.client_count_macaddress) as {alias} "
        f"{DM_FROM}{where_clause(where_filters)} "
        f"BY {CE}.client_count_connection_protocol"
    )
    rename = f"| rename {CE}.client_count_connection_protocol as {proto_alias}"
    head = rest[:stats_idx]
    tail = rest[stats_idx + 1 :]
    tail = [s for s in tail if not re.search(r"rename\s+connection\.protocol", s, re.I)]
    return head + [tstats, rename, *tail]


def convert_traffic_by_protocol(rest: list[str], where_filters: list[str]) -> list[str] | None:
    if not any(
        re.search(r"stats\s+sum\(total_bytes\).*by\s+connection\.protocol", s, re.I)
        for s in rest
    ):
        return None
    stats_idx = next(
        i
        for i, s in enumerate(rest)
        if re.search(r"stats\s+sum\(total_bytes\)", s, re.I)
        and "connection.protocol" in s
    )
    tstats = (
        f"| tstats `{DM_SUMMARIES_MACRO}` sum({CE}.client_count_tx_bytes) as tx_bytes, "
        f"sum({CE}.client_count_rx_bytes) as rx_bytes, "
        f"dc({CE}.client_count_macaddress) as clients "
        f"{DM_FROM}{where_clause(where_filters)} "
        f"BY {CE}.client_count_connection_protocol"
    )
    rename = f"| rename {CE}.client_count_connection_protocol as Protocol"
    eval_stage = (
        "| eval total_bytes=coalesce(tx_bytes,0)+coalesce(rx_bytes,0), "
        "traffic_bytes=total_bytes, traffic_mb=round(traffic_bytes/1048576, 1)"
    )
    head = [s for s in rest[:stats_idx] if not re.search(r"eval\s+total_bytes", s, re.I)]
    tail = rest[stats_idx + 1 :]
    tail = [s for s in tail if not re.search(r"rename\s+connection\.protocol", s, re.I)]
    return head + [tstats, rename, eval_stage, *tail]


def convert_traffic_timechart(rest: list[str], where_filters: list[str]) -> list[str] | None:
    tc_idx = next(
        (i for i, s in enumerate(rest) if TIMECHART_RE.match(s) and "Protocol" in s),
        None,
    )
    if tc_idx is None:
        return None
    if not any("traffic." in s or "txBytes" in s for s in rest[:tc_idx]):
        return None
    span = tstats_span_from_timechart(rest[tc_idx])
    tstats = (
        f"| tstats `{DM_SUMMARIES_MACRO}` sum({CE}.client_count_tx_bytes) as tx_bytes, "
        f"sum({CE}.client_count_rx_bytes) as rx_bytes "
        f"{DM_FROM}{where_clause(where_filters)} "
        f"BY _time span={span}, {CE}.client_count_connection_protocol"
    )
    rename = f"| rename {CE}.client_count_connection_protocol as Protocol"
    eval_stage = (
        "| eval total_bytes=coalesce(tx_bytes,0)+coalesce(rx_bytes,0)"
    )
    head = [
        s
        for s in rest[:tc_idx]
        if not re.search(
            r"rename\s+connection\.protocol|rename\s+traffic\.\*|eval\s+tx_bytes",
            s,
            re.I,
        )
    ]
    return head + [tstats, rename, eval_stage, rest[tc_idx], *rest[tc_idx + 1 :]]


def convert_health_distribution(rest: list[str], where_filters: list[str]) -> list[str] | None:
    if not rest or not re.search(r"eval\s+health_band\s*=\s*case\(", rest[0], re.I):
        return None
    eval_stage = rest[0] if rest[0].startswith("|") else "| " + rest[0]
    tstats = (
        f"| tstats `{DM_SUMMARIES_MACRO}` latest({CE}.client_count_overall_score) "
        f"as \"health.overallScore\", latest({CE}.client_count_type) as type "
        f"{DM_FROM}{where_clause(where_filters)} BY {CE}.client_count_macaddress"
    )
    return [tstats, eval_stage, *rest[1:]]


def convert_timechart_dc(rest: list[str], where_filters: list[str]) -> list[str] | None:
    tc_idx = next((i for i, s in enumerate(rest) if TIMECHART_RE.match(s)), None)
    if tc_idx is None:
        return None
    tc = rest[tc_idx]
    if not re.search(r"dc\(macAddress\)", tc, re.I):
        return None
    span = tstats_span_from_timechart(tc)
    alias_m = re.search(r"dc\(macAddress\)\s+as\s+(\w+)", tc, re.I)
    alias = alias_m.group(1) if alias_m else "concurrent_clients"
    tstats = (
        f"| tstats `{DM_SUMMARIES_MACRO}` dc({CE}.client_count_macaddress) as {alias} "
        f"{DM_FROM}{where_clause(where_filters)} BY _time span={span}"
    )
    return [tstats, *rest[tc_idx + 1 :]]


def convert_timechart_avg_health(rest: list[str], where_filters: list[str]) -> list[str] | None:
    tc_idx = next((i for i, s in enumerate(rest) if TIMECHART_RE.match(s)), None)
    if tc_idx is None:
        return None
    if not any(re.search(r"health\.overallScore|cl_health", s, re.I) for s in rest[: tc_idx + 1]):
        return None
    tc = rest[tc_idx]
    span = tstats_span_from_timechart(tc)
    alias_m = re.search(r'as\s+("?[\w ]+"?)', tc)
    alias = alias_m.group(1) if alias_m else '"Avg Client Health"'
    tstats = (
        f"| tstats `{DM_SUMMARIES_MACRO}` avg({CE}.client_count_overall_score) as {alias} "
        f"{DM_FROM}{where_clause(where_filters)} BY _time span={span}"
    )
    tail = rest[tc_idx + 1 :]
    if not any('round(' in s and 'Avg Client Health' in s for s in tail):
        tail = [f'| eval {alias} = round({alias}, 2)', *tail]
    head = [s for s in rest[:tc_idx] if not re.search(r"eval\s+cl_health", s, re.I)]
    return head + [tstats, *tail]


def convert_stages(stages: list[str]) -> list[str] | None:
    if not stages:
        return None
    opener_filters: list[str] = []
    rest: list[str] = []
    first = stages[0].lstrip("| ").strip()
    if not OPENER_RE.search(first):
        return None
    remainder, opener_filters = extract_opener_filters(
        first if stages[0].startswith("|") else first
    )
    if remainder:
        rest.append(remainder if remainder.startswith("|") else "| " + remainder)
    rest.extend(stages[1:])
    if len(rest) == 0 and not opener_filters:
        return None

    for fn in (
        convert_health_distribution,
        convert_dc_by_protocol,
        convert_traffic_by_protocol,
        convert_traffic_timechart,
        convert_timechart_avg_health,
        convert_timechart_dc,
    ):
        converted = fn(rest, opener_filters)
        if converted:
            return converted
    return None


def should_skip(name: str, search: str) -> str | None:
    if "datamodel=Cisco_Catalyst_App" in search and "Client_Events" in search:
        return "already_dm"
    if not OPENER_RE.search(search):
        return "no_opener"
    if any(m in search for m in NON_DM_MARKERS):
        return "non_dm_fields"
    # base ref stanzas: opener only
    stages = unfold_search(search)
    if len(stages) == 1 and OPENER_RE.search(stages[0]) and not stages[0].strip().endswith("|"):
        tail = stages[0]
        if OPENER_RE.search(tail) and "|" not in tail.replace("`index_catalyst`", ""):
            return "base_ref_only"
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
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--only", nargs="*", help="Convert only these stanza names")
    args = parser.parse_args()
    only = set(args.only) if args.only else None
    converted, n_skipped, skipped = convert_file(args.source, args.dry_run, only)
    print(f"converted={converted} skipped={n_skipped}")
    for line in skipped:
        if "client" in line.lower() or "user_experience" in line.lower():
            print(f"  {line}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
