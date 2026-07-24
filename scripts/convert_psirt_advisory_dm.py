#!/usr/bin/env python3
"""PSIRT / security advisory searches → Cisco_Catalyst_Security_Advisories_Events."""

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

SA = "Cisco_Catalyst_Dataset.Cisco_Catalyst_Security_Advisories_Events"
DM_FROM = f"FROM datamodel=Cisco_Catalyst_App WHERE nodename={SA}"
DM_SUMMARIES_MACRO = "summariesonly"

RAW_TO_DM = {
    "AdvisoryID": "security_advisories_advisory_id",
    "AdvisorySir": "security_advisories_advisory_sir",
    "DeviceName": "security_advisories_device_name",
    "Summary": "security_advisories_summary",
    "AdvisoryCvesStr": "security_advisories_advisory_cves_str",
    "AdvisoryPublicationUrl": "security_advisories_advisory_publication_url",
}

OPENER_RE = re.compile(
    r"`index_catalyst`\s+sourcetype(?:\s+IN\s*\(\s*cisco:dnac:securityadvisory\s*,\s*"
    r"cisco:catalyst:securityadvisory\s*\)|\s*=\s*\"cisco:dnac:securityadvisory\")",
    re.I,
)

NON_DM_MARKERS = ("DeviceFamily", "DeviceIpAddress", "SubCategory")


def load_formatter():
    spec = importlib.util.spec_from_file_location("format_searchbase_conf", FORMAT_SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


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


def extract_filters(stage: str) -> list[str]:
    m = OPENER_RE.search(stage)
    if not m:
        return []
    after = stage[m.end() :].strip()
    filters: list[str] = []
    if after and not after.startswith("|"):
        pipe_idx = after.find(" | ")
        blob = after[:pipe_idx] if pipe_idx >= 0 else after
        for or_group in re.findall(r"\(([^)]+)\)", blob):
            parts = re.findall(r'([A-Za-z]+)\s*=\s*"([^"]+)"', or_group)
            if parts:
                mapped = " OR ".join(
                    f'{SA}.{RAW_TO_DM[f]}="{v}"' for f, v in parts if f in RAW_TO_DM
                )
                if mapped:
                    filters.append(f"({mapped})")
    return filters


def convert_stages(stages: list[str]) -> list[str] | None:
    if not stages or not OPENER_RE.search(stages[0]):
        return None
    filters = extract_filters(stages[0])
    where = (" " + " ".join(filters)) if filters else ""
    rest = stages[1:]

    if rest:
        stats_idx = next(
            (
                i
                for i, s in enumerate(rest)
                if re.search(
                    r"stats\s+latest\(AdvisorySeverity\).*dc\(DeviceName\).*by\s+AdvisoryID",
                    s,
                    re.I,
                )
            ),
            None,
        )
        if stats_idx is not None:
            eval_stages = [
                s for s in rest[:stats_idx] if re.search(r"^\|?\s*eval\s+", s, re.I)
            ]
            tail = rest[stats_idx + 1 :]
            tstats = (
                f"| tstats `{DM_SUMMARIES_MACRO}` "
                f"latest({SA}.security_advisories_advisory_sir) as AdvisorySir, "
                f"dc({SA}.security_advisories_device_name) as affected_devices "
                f"{DM_FROM}{where} BY {SA}.security_advisories_advisory_id"
            )
            rename = f"| rename {SA}.security_advisories_advisory_id as AdvisoryID"
            evals = eval_stages or [
                "| eval AdvisorySeverity=upper(AdvisorySir), "
                'severity_rank=case(AdvisorySeverity=="CRITICAL",4, AdvisorySeverity=="HIGH",3, '
                'AdvisorySeverity=="MEDIUM",2, AdvisorySeverity=="LOW",1, 1==1,0)'
            ]
            return [tstats, rename, *evals, *tail]

    return None


def should_skip(_: str, search: str) -> str | None:
    if "datamodel=Cisco_Catalyst_App" in search and "Security_Advisories" in search:
        return "already_dm"
    if not OPENER_RE.search(search):
        return "no_opener"
    if any(m in search for m in NON_DM_MARKERS):
        return "non_dm_fields"
    return None


def convert_file(path: Path, dry_run: bool = False) -> tuple[int, int, list[str]]:
    fmt = load_formatter()
    stanzas = fmt.parse_stanzas(path.read_text())
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
    print(f"psirt converted={c} skipped={s}")
    for line in lines:
        if "psirt" in line.lower() or "advisory" in line.lower():
            print(f"  {line}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
