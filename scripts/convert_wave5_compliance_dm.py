#!/usr/bin/env python3
"""Convert raw DNAC/Catalyst Center compliance searches to Cisco_Catalyst_App tstats.

Wave 5: Cisco_Catalyst_Device_Compliance_Events and
Cisco_Catalyst_Center_Compliance_Report datasets.
Skips lookup enrichment and stanzas needing non-DM device metadata fields.
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

DC = "Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Compliance_Events"
CR = (
    "Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports."
    "Cisco_Catalyst_Center_Compliance_Report"
)
DM_SUMMARIES_MACRO = "summariesonly"

RAW_TO_DM_DC: dict[str, str] = {
    "ComplianceDeviceID": "device_compliance_device_id",
    "DeviceID": "device_compliance_device_id",
    "DeviceName": "device_compliance_device_name",
    "ComplianceStatus": "device_compliance_status",
    "DeviceRole": "device_compliance_device_role",
    "IpAddress": "device_compliance_ip_address",
    "MACAddress": "device_compliance_mac_address",
    "Manageability": "device_compliance_manageability",
    "Reachability": "device_compliance_reachability",
    "ComplianceComplianceType": "device_compliance_type",
    "ComplianceState": "device_compliance_state",
    "ComplianceDetail": "device_compliance_detail",
}

RAW_TO_DM_CR: dict[str, str] = {
    '"Device Name"': "cisco_catalyst_compliance_report_device_name",
    "deviceName": "cisco_catalyst_compliance_report_device_name",
    '"Compliance Status"': "cisco_catalyst_compliance_report_compliance_status",
    "complianceStatus": "cisco_catalyst_compliance_report_compliance_status",
    '"IP Address"': "cisco_catalyst_compliance_report_ip_address",
    '"Software Image"': "cisco_catalyst_compliance_report_software_image",
    "EoX": "cisco_catalyst_compliance_report_eox",
    '"Network Settings"': "cisco_catalyst_compliance_report_network_settings",
    '"Startup Vs Running Configuration"': (
        "cisco_catalyst_compliance_report_startup_vs_running_configuration"
    ),
    '"Critical Security Advisories"': (
        "cisco_catalyst_compliance_report_critical_security_advisories"
    ),
}

OPENER_COMPLIANCE_RE = re.compile(
    r"`index_catalyst`\s+sourcetype(?:\s+IN\s*\(\s*cisco:dnac:compliance\s*,\s*"
    r"cisco:catalyst:compliance\s*\)|\s*=\s*\"cisco:dnac:compliance\")",
    re.I,
)

OPENER_REPORT_RE = re.compile(
    r'`index_catalyst`\s+sourcetype\s*=\s*"cisco:catalyst:center:compliance:report"',
    re.I,
)

NON_DM_MARKERS = (
    "inputlookup",
    "| lookup",
    "DeviceFamily",
    "DeviceSeries",
    "Platform",
    "ImageVersion",
    "Uptime",
    '"Device Family"',
    '"Device Type"',
    '"Network Profile"',
    '"Application Visibility"',
    '"Customization Profile"',
    "Fabric",
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


def bump_version(ver: str) -> str:
    parts = ver.split(".")
    if len(parts) == 3 and parts[2].isdigit():
        parts[2] = str(int(parts[2]) + 1)
        return ".".join(parts)
    return "1.1.0"


def where_clause(filters: list[str]) -> str:
    where = " ".join(filters)
    return f" {where}" if where else ""


def map_filter_field(field: str, raw_to_dm: dict[str, str], prefix: str) -> str:
    field = field.strip()
    if field in raw_to_dm:
        return f"{prefix}.{raw_to_dm[field]}"
    return field


def extract_opener_filters(
    stage: str,
    opener_re: re.Pattern[str],
    raw_to_dm: dict[str, str],
    prefix: str,
) -> tuple[str, list[str]]:
    m = opener_re.search(stage)
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
        for field, op, val in re.findall(r'([A-Za-z]+)\s*(!=|=)\s*(\S+)', filter_blob):
            if field in raw_to_dm:
                filters.append(f"{prefix}.{raw_to_dm[field]}{op}{val}")
        for quoted_field, op, val in re.findall(
            r'("(?:[^"\\]|\\.)+")\s*(!=|=)\s*(\S+)', filter_blob
        ):
            key = quoted_field
            if key in raw_to_dm:
                filters.append(f"{prefix}.{raw_to_dm[key]}{op}{val}")
    remainder = after.strip()
    if remainder and not remainder.startswith("|"):
        remainder = "| " + remainder
    return remainder, filters


def rename_dims(fields: set[str], raw_to_dm: dict[str, str], prefix: str) -> str | None:
    parts: list[str] = []
    for raw in sorted(fields):
        if raw in raw_to_dm:
            parts.append(f"{prefix}.{raw_to_dm[raw]} as {raw}")
        elif raw.strip('"') in {k.strip('"') for k in raw_to_dm}:
            for k, dm in raw_to_dm.items():
                if k.strip('"') == raw.strip('"'):
                    parts.append(f"{prefix}.{dm} as {raw}")
                    break
    return "| rename " + ", ".join(parts) if parts else None


def convert_check_level_rate(rest: list[str], where_filters: list[str]) -> list[str] | None:
    """eval ok=... | stats sum(ok) as compliant, count as total | eval pct ..."""
    eval_idx = next(
        (i for i, s in enumerate(rest) if re.search(r"eval\s+ok\s*=", s, re.I)),
        None,
    )
    stats_idx = next(
        (
            i
            for i, s in enumerate(rest)
            if re.search(r"stats\s+sum\(ok\)\s+as\s+compliant", s, re.I)
        ),
        None,
    )
    if stats_idx is None:
        return None
    tail = rest[stats_idx + 1 :]
    tstats = (
        f"| tstats `{DM_SUMMARIES_MACRO}` count as cnt "
        f"FROM datamodel=Cisco_Catalyst_App WHERE nodename={DC}{where_clause(where_filters)} "
        f"BY {DC}.device_compliance_status"
    )
    rename = rename_dims({"ComplianceStatus"}, RAW_TO_DM_DC, DC)
    out = [tstats]
    if rename:
        out.append(rename)
    out.append(
        '| eval ok=if(ComplianceStatus IN ("COMPLIANT","COMPLIANT_WARNING"), cnt, 0)'
    )
    out.append("| stats sum(ok) as compliant, sum(cnt) as total")
    out.extend(tail)
    return out


def convert_device_status_distribution(
    rest: list[str],
    where_filters: list[str],
    device_key: str,
) -> list[str] | None:
    """stats latest(ComplianceStatus) as X by DeviceName|DeviceID -> stats count by status"""
    stats_idx = next(
        (
            i
            for i, s in enumerate(rest)
            if re.search(r"stats\s+latest\(ComplianceStatus\)", s, re.I)
            and re.search(rf"\bby\s+{device_key}\b", s, re.I)
        ),
        None,
    )
    if stats_idx is None:
        return None
    dm_device = RAW_TO_DM_DC[device_key]
    tstats = (
        f"| tstats `{DM_SUMMARIES_MACRO}` latest({DC}.device_compliance_status) "
        f"as ComplianceStatus FROM datamodel=Cisco_Catalyst_App WHERE nodename={DC}"
        f"{where_clause(where_filters)} BY {DC}.{dm_device}"
    )
    tail = rest[stats_idx + 1 :]
    return [tstats, *tail]


def convert_device_kpi_compliance(rest: list[str], where_filters: list[str]) -> list[str] | None:
    """stats latest by DeviceID -> stats count(eval(status=COMPLIANT)) ..."""
    if not rest or not re.search(
        r"stats\s+latest\(ComplianceStatus\)\s+as\s+status\s+by\s+DeviceID",
        rest[0],
        re.I,
    ):
        return None
    tstats = (
        f"| tstats `{DM_SUMMARIES_MACRO}` latest({DC}.device_compliance_status) as status "
        f"FROM datamodel=Cisco_Catalyst_App WHERE nodename={DC}{where_clause(where_filters)} "
        f"BY {DC}.device_compliance_device_id"
    )
    return [tstats, *rest[1:]]


def convert_donut_distribution(rest: list[str], where_filters: list[str]) -> list[str] | None:
    if len(rest) < 2:
        return None
    if not re.search(
        r"stats\s+latest\(ComplianceStatus\)\s+as\s+status\s+by\s+DeviceName",
        rest[0],
        re.I,
    ):
        return None
    tstats = (
        f"| tstats `{DM_SUMMARIES_MACRO}` latest({DC}.device_compliance_status) as status "
        f"FROM datamodel=Cisco_Catalyst_App WHERE nodename={DC}{where_clause(where_filters)} "
        f"BY {DC}.device_compliance_device_name"
    )
    return [tstats, *rest[1:]]


def convert_dc_by_status_and_type(rest: list[str], where_filters: list[str]) -> list[str] | None:
    if not rest or not re.search(
        r"stats\s+dc\(DeviceName\)\s+as\s+device_count\s+by\s+ComplianceStatus,\s*ComplianceComplianceType",
        rest[0],
        re.I,
    ):
        return None
    tstats = (
        f"| tstats `{DM_SUMMARIES_MACRO}` dc({DC}.device_compliance_device_name) as device_count "
        f"FROM datamodel=Cisco_Catalyst_App WHERE nodename={DC}{where_clause(where_filters)} "
        f"BY {DC}.device_compliance_status, {DC}.device_compliance_type"
    )
    rename = rename_dims({"ComplianceStatus", "ComplianceComplianceType"}, RAW_TO_DM_DC, DC)
    out = [tstats]
    if rename:
        out.append(rename)
    out.extend(rest[1:])
    return out


def convert_report_device_rate(rest: list[str], where_filters: list[str]) -> list[str] | None:
    stats_idx = next(
        (
            i
            for i, s in enumerate(rest)
            if re.search(r'stats\s+latest\("Compliance Status"\)', s, re.I)
            and '"Device Name"' in s
        ),
        None,
    )
    if stats_idx is None:
        return None
    tstats = (
        f"| tstats `{DM_SUMMARIES_MACRO}` "
        f"latest({CR}.cisco_catalyst_compliance_report_compliance_status) as \"Compliance Status\" "
        f"FROM datamodel=Cisco_Catalyst_App WHERE nodename={CR}{where_clause(where_filters)} "
        f"BY {CR}.cisco_catalyst_compliance_report_device_name"
    )
    return [tstats, *rest[stats_idx + 1 :]]


def convert_report_status_distribution(
    rest: list[str],
    where_filters: list[str],
) -> list[str] | None:
    if not rest or not re.search(
        r'stats\s+latest\("Compliance Status"\).*by\s+"Device Name"',
        rest[0],
        re.I,
    ):
        return None
    if re.search(r"eval\s+compliant", rest[0], re.I):
        return None
    tstats = (
        f"| tstats `{DM_SUMMARIES_MACRO}` "
        f"latest({CR}.cisco_catalyst_compliance_report_compliance_status) as \"Compliance Status\" "
        f"FROM datamodel=Cisco_Catalyst_App WHERE nodename={CR}{where_clause(where_filters)} "
        f"BY {CR}.cisco_catalyst_compliance_report_device_name"
    )
    return [tstats, *rest[1:]]


def convert_report_camel_kpi(rest: list[str], where_filters: list[str]) -> list[str] | None:
    if not rest or not re.search(
        r"stats\s+latest\(complianceStatus\)\s+as\s+status\s+by\s+deviceName",
        rest[0],
        re.I,
    ):
        return None
    tstats = (
        f"| tstats `{DM_SUMMARIES_MACRO}` "
        f"latest({CR}.cisco_catalyst_compliance_report_compliance_status) as status "
        f"FROM datamodel=Cisco_Catalyst_App WHERE nodename={CR}{where_clause(where_filters)} "
        f"BY {CR}.cisco_catalyst_compliance_report_device_name"
    )
    return [tstats, *rest[1:]]


def convert_compliance_stages(stages: list[str]) -> list[str] | None:
    if not stages:
        return None
    opener_filters: list[str] = []
    rest: list[str] = []
    first = stages[0].lstrip("| ").strip()
    if OPENER_COMPLIANCE_RE.search(first):
        remainder, opener_filters = extract_opener_filters(
            first if stages[0].startswith("|") else first,
            OPENER_COMPLIANCE_RE,
            RAW_TO_DM_DC,
            DC,
        )
        if remainder:
            rest.append(remainder if remainder.startswith("|") else "| " + remainder)
        rest.extend(stages[1:])
        for fn in (
            convert_check_level_rate,
            lambda r, w: convert_device_status_distribution(r, w, "DeviceName"),
            convert_device_kpi_compliance,
            convert_donut_distribution,
            convert_dc_by_status_and_type,
        ):
            converted = fn(rest, opener_filters)
            if converted:
                return converted
    return None


def convert_report_stages(stages: list[str]) -> list[str] | None:
    if not stages:
        return None
    opener_filters: list[str] = []
    rest: list[str] = []
    first = stages[0].lstrip("| ").strip()
    if not OPENER_REPORT_RE.search(first):
        return None
    remainder, opener_filters = extract_opener_filters(
        first if stages[0].startswith("|") else first,
        OPENER_REPORT_RE,
        RAW_TO_DM_CR,
        CR,
    )
    if remainder:
        rest.append(remainder if remainder.startswith("|") else "| " + remainder)
    rest.extend(stages[1:])
    for fn in (
        convert_report_device_rate,
        convert_report_status_distribution,
        convert_report_camel_kpi,
    ):
        converted = fn(rest, opener_filters)
        if converted:
            return converted
    return None


def convert_stages(stages: list[str]) -> list[str] | None:
    return convert_compliance_stages(stages) or convert_report_stages(stages)


def should_skip(name: str, search: str) -> str | None:
    if "datamodel=Cisco_Catalyst_App" in search and (
        "Device_Compliance_Events" in search or "Center_Compliance_Report" in search
    ):
        return "already_dm"
    if not OPENER_COMPLIANCE_RE.search(search) and not OPENER_REPORT_RE.search(search):
        return "no_opener"
    if any(m in search for m in NON_DM_MARKERS):
        return "non_dm_fields"
    return None


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
        if "compliance" in line.lower() or "resilience" in line.lower():
            print(f"  {line}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
