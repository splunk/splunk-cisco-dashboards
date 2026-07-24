#!/usr/bin/env python3
"""Wave 7: Cisco_Catalyst_Audit_Log_Events — simple count / breakdown searches."""

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

AL = "Cisco_Catalyst_Dataset.Cisco_Catalyst_Audit_Log_Events"
DM_FROM = f"FROM datamodel=Cisco_Catalyst_App WHERE nodename={AL}"
DM_SUMMARIES_MACRO = "summariesonly"

# DNAC audit SPL uses ``name``; the DM exposes it as ``category``.
RAW_TO_DM = {
    "name": "audit_logs_category",
    "severity": "audit_logs_severity",
    "category": "audit_logs_category",
    "userId": "audit_logs_userid",
    "description": "audit_logs_description",
}

OPENER_RE = re.compile(
    r'`index_catalyst`\s+sourcetype\s*=\s*"cisco:dnac:audit:logs"',
    re.I,
)

NON_DM_MARKERS = (
    "index_meraki",
    "parentInstanceId",
    "description LIKE",
    "| rex",
    "index_firewall",
    "index_identity",
    "index_windows",
    " OR (`index",
)


def load_formatter():
    spec = importlib.util.spec_from_file_location("format_searchbase_conf", FORMAT_SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def parse_stanzas(text: str):
    return load_formatter().parse_stanzas(text)


def unfold_search(search: str) -> list[str]:
    stages, buf = [], ""
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
    out = []
    for i, stage in enumerate(stages):
        stage = stage.strip()
        if not stage.startswith("|"):
            stage = "| " + stage
        out.append(stage + ("\\" if i < len(stages) - 1 else ""))
    return "\n".join(out)


def bump_version(ver: str) -> str:
    parts = ver.split(".")
    if len(parts) == 3 and parts[2].isdigit():
        parts[2] = str(int(parts[2]) + 1)
        return ".".join(parts)
    return "1.1.0"


def extract_filters(stage: str) -> tuple[str, list[str]]:
    m = OPENER_RE.search(stage)
    if not m:
        return stage, []
    after = stage[m.end() :].strip()
    filters: list[str] = []
    if after and not after.startswith("|"):
        pipe_idx = after.find(" | ")
        blob = after[:pipe_idx] if pipe_idx >= 0 else after
        after = after[pipe_idx + 3 :].strip() if pipe_idx >= 0 else ""
        for m_not in re.finditer(r"NOT\s+name\s+IN\s*\(([^)]+)\)", blob, re.I):
            vals = m_not.group(1)
            filters.append(f"NOT {AL}.audit_logs_category IN ({vals})")
        blob = re.sub(r"NOT\s+name\s+IN\s*\([^)]+\)", "", blob, flags=re.I)
        for field, op, val in re.findall(r'([A-Za-z]+)\s*(!=|=)\s*"([^"]+)"', blob):
            if field in RAW_TO_DM:
                filters.append(f'{AL}.{RAW_TO_DM[field]}{op}"{val}"')
    remainder = after.strip()
    if remainder and not remainder.startswith("|"):
        remainder = "| " + remainder
    return remainder, filters


def convert_stages(stages: list[str]) -> list[str] | None:
    if not stages or not OPENER_RE.search(stages[0]):
        return None
    _, filters = extract_filters(stages[0])
    rest = stages[1:]
    where = (" " + " ".join(filters)) if filters else ""

    if len(rest) == 1 and re.match(r"stats\s+count\s*$", rest[0].lstrip("| ").strip(), re.I):
        return [f"| tstats `{DM_SUMMARIES_MACRO}` count {DM_FROM}{where}"]

    if rest and re.search(r"stats\s+count\s+by\s+severity,\s*name", rest[0], re.I):
        tstats = (
            f"| tstats `{DM_SUMMARIES_MACRO}` count {DM_FROM}{where} "
            f"BY {AL}.audit_logs_severity, {AL}.audit_logs_category"
        )
        rename = (
            f"| rename {AL}.audit_logs_severity as severity, "
            f"{AL}.audit_logs_category as name"
        )
        return [tstats, rename, *rest[1:]]
    return None


def should_skip(_: str, search: str) -> str | None:
    if "datamodel=Cisco_Catalyst_App" in search and "Audit_Log_Events" in search:
        return "already_dm"
    if not OPENER_RE.search(search):
        return "no_opener"
    if any(m in search for m in NON_DM_MARKERS):
        return "non_dm_fields"
    return None


def convert_file(path: Path, dry_run: bool = False) -> tuple[int, int, list[str]]:
    fmt = load_formatter()
    stanzas = parse_stanzas(path.read_text())
    converted, skipped, new_stanzas = 0, [], []
    for name, fields in stanzas:
        search = fields.get("search", "")
        reason = should_skip(name, search)
        if reason:
            if reason != "already_dm":
                skipped.append(f"{name}: {reason}")
            new_stanzas.append((name, fields))
            continue
        pipeline = convert_stages(unfold_search(search))
        if not pipeline:
            skipped.append(f"{name}: convert_failed")
            new_stanzas.append((name, fields))
            continue
        fields = dict(fields)
        fields["search"] = fold_search(pipeline)
        fields["dispatch_context"] = "splunk-cisco-dashboards"
        fields["dispatch_context_force"] = "1"
        fields["date_updated"] = "2026-07-01"
        fields["version"] = bump_version(fields.get("version", "1.0.0"))
        converted += 1
        new_stanzas.append((name, fields))
    if dry_run:
        return converted, len(skipped), skipped
    parts = [fmt.format_stanza(n, f)[0] for n, f in new_stanzas]
    path.write_text("\n\n".join(parts).rstrip() + "\n")
    return converted, len(skipped), skipped


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    c, s, lines = convert_file(args.source, args.dry_run)
    print(f"wave7 converted={c} skipped={s}")
    for line in lines:
        if "audit" in line.lower() or "configuration" in line.lower():
            print(f"  {line}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
